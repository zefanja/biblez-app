// The learning engine: creates collections, applies reviews (with the
// "one stage at a time" rules from product brief 4.3) and builds the daily queue.
// Pure functions over an in-memory snapshot; persistence is the caller's job.

import { ankiGuid, nextAnkiId, uid } from "./ids";
import {
  DEFAULT_SETTINGS,
  STAGES,
  type Card,
  type Collection,
  type Rating,
  type Review,
  type Segment,
  type Settings,
  type Stage,
} from "./model";
import { dayStart, nextDayStart } from "./scheduler/day";
import { replay, State, type FsrsCard } from "./scheduler/fsrs";
import { chunkVerse } from "./text/chunk";
import type { Verse } from "./text/parse";

export interface Snapshot {
  collections: Collection[];
  segments: Segment[];
  cards: Card[];
  reviews: Review[];
}

export function emptySnapshot(): Snapshot {
  return { collections: [], segments: [], cards: [], reviews: [] };
}

// ---------------------------------------------------------------- creation

export interface NewCollectionInput {
  title: string;
  verses: Verse[];
  translation?: string | null;
  source?: "bundled" | "custom";
  learnReference?: boolean;
  /** Pre-split chunks per verse (from the edit screen); otherwise chunkVerse() is used. */
  chunks?: string[][];
}

export interface CreatedCollection {
  collection: Collection;
  segments: Segment[];
  cards: Card[];
}

const PART_LETTERS = "abcdefghijklmnopqrstuvwxyz";

export function createCollection(
  input: NewCollectionInput,
  now: number = Date.now(),
  settings: Settings = DEFAULT_SETTINGS,
): CreatedCollection {
  const kind = input.verses.length === 1 ? "verse" : "passage";
  const collection: Collection = {
    id: uid(now),
    title: input.title.trim(),
    kind,
    translation: input.translation ?? null,
    source: input.source ?? "custom",
    learnReference: kind === "verse" ? true : (input.learnReference ?? true),
    createdAt: now,
    ankiDeckId: nextAnkiId(now),
  };
  const segments: Segment[] = [];
  const cards: Card[] = [];
  input.verses.forEach((verse, vi) => {
    const parts = input.chunks?.[vi] ?? chunkVerse(verse.text);
    parts.forEach((text, pi) => {
      const segment: Segment = {
        id: uid(now),
        collectionId: collection.id,
        position: segments.length,
        verseNumber: verse.number,
        part: PART_LETTERS[pi % 26]!,
        text,
        ankiNoteId: nextAnkiId(now),
        ankiGuid: ankiGuid(),
      };
      segments.push(segment);
      for (const stage of STAGES) {
        const active = stage === 1 || settings.allStagesAtOnce;
        cards.push({
          id: uid(now),
          segmentId: segment.id,
          stage,
          ankiCardId: nextAnkiId(now),
          unlockedAt: active ? now : null,
          retiredAt: null,
        });
      }
    });
  });
  return { collection, segments, cards };
}

// ------------------------------------------------------------------ status

export interface CardStatus {
  card: Card;
  fsrs: FsrsCard;
  reviewCount: number;
  isNew: boolean;
  /** Active = unlocked (and available), not retired. */
  active: boolean;
  due: number;
}

export function reviewsOf(snapshot: Snapshot, cardId: string): Review[] {
  return snapshot.reviews.filter((r) => r.cardId === cardId);
}

export function cardStatus(snapshot: Snapshot, card: Card, now: number, settings: Settings = DEFAULT_SETTINGS): CardStatus {
  const reviews = reviewsOf(snapshot, card.id);
  const { card: fsrs } = replay(reviews, settings.desiredRetention, card.unlockedAt ?? now);
  const active = card.unlockedAt !== null && card.unlockedAt <= now && card.retiredAt === null;
  return {
    card,
    fsrs,
    reviewCount: reviews.length,
    isNew: reviews.length === 0,
    active,
    due: fsrs.due.getTime(),
  };
}

// ----------------------------------------------------------------- reviews

export interface ReviewResult {
  review: Review;
  /** Cards whose unlock/retire fields changed and must be persisted. */
  changedCards: Card[];
  status: CardStatus;
  /** Set when the next stage was unlocked by this review. */
  unlockedStage: Stage | null;
}

export function applyReview(
  snapshot: Snapshot,
  cardId: string,
  rating: Rating,
  now: number = Date.now(),
  durationMs = 0,
  settings: Settings = DEFAULT_SETTINGS,
): ReviewResult {
  const card = snapshot.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`unknown card ${cardId}`);
  const review: Review = { id: uid(now), cardId, reviewedAt: now, rating, durationMs: Math.max(0, Math.round(durationMs)) };
  snapshot.reviews.push(review);
  const status = cardStatus(snapshot, card, now, settings);
  const changedCards: Card[] = [];
  let unlockedStage: Stage | null = null;

  if (!settings.allStagesAtOnce && card.stage < 3 && card.retiredAt === null) {
    const graduated = status.fsrs.state === State.Review && status.fsrs.stability >= settings.unlockStabilityDays;
    if (graduated) {
      const next = snapshot.cards.find((c) => c.segmentId === card.segmentId && c.stage === card.stage + 1);
      if (next && next.unlockedAt === null) {
        next.unlockedAt = nextDayStart(now, settings.dayStartHour); // never the same day as its sibling
        card.retiredAt = now;
        changedCards.push(next, card);
        unlockedStage = next.stage;
      }
    }
  }
  return { review, changedCards, status, unlockedStage };
}

/**
 * After two "again" in a row on stage 2 or 3, the app offers to bring back
 * the previous stage as help. Returns that resting card, if any.
 */
export function fallbackCandidate(snapshot: Snapshot, cardId: string): Card | null {
  const card = snapshot.cards.find((c) => c.id === cardId);
  if (!card || card.stage === 1) return null;
  const reviews = reviewsOf(snapshot, cardId).sort((a, b) => a.reviewedAt - b.reviewedAt);
  const lastTwo = reviews.slice(-2);
  if (lastTwo.length < 2 || lastTwo.some((r) => r.rating !== "again")) return null;
  const prev = snapshot.cards.find((c) => c.segmentId === card.segmentId && c.stage === card.stage - 1);
  return prev && prev.retiredAt !== null ? prev : null;
}

export function reactivate(card: Card): Card {
  card.retiredAt = null;
  return card;
}

// ------------------------------------------------------------------- queue

export interface Queue {
  /** Cards to study now, in order. */
  now: CardStatus[];
  /** Learning cards due later today (shown once their step has passed). */
  later: CardStatus[];
  newLeftToday: number;
}

const LEARN_AHEAD_MS = 20 * 60_000;

/** Stable pseudo-random number per card and day, so the shuffled order does not jump between renders. */
function dailyRank(cardId: string, day: number): number {
  let h = 2166136261 ^ day;
  for (let i = 0; i < cardId.length; i++) {
    h ^= cardId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildQueue(snapshot: Snapshot, now: number = Date.now(), settings: Settings = DEFAULT_SETTINGS): Queue {
  const todayStart = dayStart(now, settings.dayStartHour);
  const tomorrow = nextDayStart(now, settings.dayStartHour);
  const segById = new Map(snapshot.segments.map((s) => [s.id, s]));
  const colById = new Map(snapshot.collections.map((c) => [c.id, c]));

  // New stage-1 segments already introduced today count against the daily limit.
  const firstReview = new Map<string, number>();
  for (const r of snapshot.reviews) {
    const prev = firstReview.get(r.cardId);
    if (prev === undefined || r.reviewedAt < prev) firstReview.set(r.cardId, r.reviewedAt);
  }
  const introducedToday = snapshot.cards.filter((c) => {
    const t = firstReview.get(c.id);
    return c.stage === 1 && t !== undefined && t >= todayStart;
  }).length;
  const newLeftToday = Math.max(0, settings.newSegmentsPerDay - introducedToday);

  const statuses = snapshot.cards
    .filter((c) => segById.has(c.segmentId))
    .map((c) => cardStatus(snapshot, c, now, settings))
    .filter((s) => s.active);

  const dueReviews: CardStatus[] = [];
  const learningNow: CardStatus[] = [];
  const learnAhead: CardStatus[] = [];
  const later: CardStatus[] = [];
  const fresh: CardStatus[] = [];
  for (const s of statuses) {
    if (s.isNew) fresh.push(s);
    else if (s.fsrs.state === State.Learning || s.fsrs.state === State.Relearning) {
      if (s.due <= now) learningNow.push(s);
      else if (s.due <= now + LEARN_AHEAD_MS) learnAhead.push(s); // shown after everything else
      else if (s.due < tomorrow) later.push(s);
    } else if (s.due < tomorrow) dueReviews.push(s);
  }

  const order = (s: CardStatus) => {
    const seg = segById.get(s.card.segmentId)!;
    const col = colById.get(seg.collectionId);
    return [col?.createdAt ?? 0, seg.position, s.card.stage] as const;
  };
  const byOrder = (a: CardStatus, b: CardStatus) => {
    const x = order(a);
    const y = order(b);
    return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
  };
  learningNow.sort((a, b) => a.due - b.due);
  learnAhead.sort((a, b) => a.due - b.due);
  // Reviews in mixed order (stable for the day); new chunks keep their text order.
  dueReviews.sort((a, b) => dailyRank(a.card.id, todayStart) - dailyRank(b.card.id, todayStart));
  later.sort((a, b) => a.due - b.due);
  fresh.sort(byOrder);

  // Stage-1 new cards are limited per day; newly unlocked higher stages are not.
  let budget = newLeftToday;
  const newCards = fresh.filter((s) => {
    if (s.card.stage > 1 || settings.allStagesAtOnce) return true;
    if (budget <= 0) return false;
    budget--;
    return true;
  });

  // At most one card per segment per day (no siblings), lower stage first.
  const seen = new Set<string>();
  const reviewedToday = new Set(
    snapshot.reviews
      .filter((r) => r.reviewedAt >= todayStart)
      .map((r) => snapshot.cards.find((c) => c.id === r.cardId)?.segmentId),
  );
  const pick = (list: CardStatus[], allowReviewedToday: boolean) =>
    list.filter((s) => {
      const segId = s.card.segmentId;
      if (seen.has(segId)) return false;
      if (!allowReviewedToday && reviewedToday.has(segId) && s.isNew) return false;
      seen.add(segId);
      return true;
    });

  const nowList = [...pick(learningNow, true), ...pick(dueReviews, true), ...pick(newCards, false), ...pick(learnAhead, true)];
  return { now: nowList, later: pick(later, true), newLeftToday };
}

// ---------------------------------------------------------------- progress

export interface VerseProgress {
  verseNumber: string;
  /** Lowest active stage over the verse's segments (1–3). */
  stage: Stage;
  /** All segments on stage 3 with stability ≥ safeStabilityDays. */
  safe: boolean;
  /** 0..1 for progress bars: stage plus stability within it. */
  progress: number;
}

export interface CollectionProgress {
  collection: Collection;
  verses: VerseProgress[];
  dueToday: number;
  nextDue: number | null;
}

export function collectionProgress(
  snapshot: Snapshot,
  collectionId: string,
  now: number = Date.now(),
  settings: Settings = DEFAULT_SETTINGS,
): CollectionProgress {
  const collection = snapshot.collections.find((c) => c.id === collectionId);
  if (!collection) throw new Error(`unknown collection ${collectionId}`);
  const segments = snapshot.segments.filter((s) => s.collectionId === collectionId).sort((a, b) => a.position - b.position);
  const tomorrow = nextDayStart(now, settings.dayStartHour);
  const byVerse = new Map<string, Segment[]>();
  for (const s of segments) byVerse.set(s.verseNumber, [...(byVerse.get(s.verseNumber) ?? []), s]);

  let dueToday = 0;
  let nextDue: number | null = null;
  const verses: VerseProgress[] = [];
  for (const [verseNumber, segs] of byVerse) {
    let minStage: Stage = 3;
    let safe = true;
    let progressSum = 0;
    for (const seg of segs) {
      const cards = snapshot.cards.filter((c) => c.segmentId === seg.id && c.unlockedAt !== null && c.retiredAt === null);
      const current = cards.sort((a, b) => a.stage - b.stage)[0];
      if (!current) continue;
      const st = cardStatus(snapshot, current, now, settings);
      if (current.stage < minStage) minStage = current.stage;
      const stability = st.isNew ? 0 : st.fsrs.stability;
      const target = current.stage === 3 ? settings.safeStabilityDays : settings.unlockStabilityDays;
      if (current.stage < 3 || stability < settings.safeStabilityDays) safe = false;
      progressSum += (current.stage - 1 + Math.min(1, stability / target)) / 3;
      if (st.active) {
        if (st.isNew || st.due < tomorrow) dueToday++;
        else nextDue = nextDue === null ? st.due : Math.min(nextDue, st.due);
      }
    }
    verses.push({ verseNumber, stage: minStage, safe, progress: progressSum / segs.length });
  }
  return { collection, verses, dueToday, nextDue };
}

export interface Overview {
  safeVerses: number;
  learningVerses: number;
  /** Number of cards due on each of the next 7 learning days (index 0 = today). */
  forecast: number[];
}

export function overview(snapshot: Snapshot, now: number = Date.now(), settings: Settings = DEFAULT_SETTINGS): Overview {
  let safeVerses = 0;
  let learningVerses = 0;
  for (const c of snapshot.collections) {
    for (const v of collectionProgress(snapshot, c.id, now, settings).verses) {
      if (v.safe) safeVerses++;
      else learningVerses++;
    }
  }
  const forecast = new Array<number>(7).fill(0);
  const todayStart = dayStart(now, settings.dayStartHour);
  for (const card of snapshot.cards) {
    if (card.unlockedAt === null || card.retiredAt !== null) continue;
    const st = cardStatus(snapshot, card, now, settings);
    if (st.isNew) continue;
    const idx = Math.max(0, Math.floor((dayStart(st.due, settings.dayStartHour) - todayStart) / 86_400_000));
    if (idx < 7) forecast[idx]!++;
  }
  return { safeVerses, learningVerses, forecast };
}
