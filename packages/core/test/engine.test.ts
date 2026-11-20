import { describe, expect, it } from "vitest";
import {
  applyReview, buildQueue, cardFace, collectionProgress, createCollection, DEFAULT_SETTINGS, emptySnapshot,
  fallbackCandidate, nextDayStart, overview, SAMPLES, type Snapshot,
} from "../src";

const DAY = 86_400_000;
const T0 = new Date(2026, 10, 20, 9, 0, 0).getTime(); // 20 Nov 2026, 09:00 local

function setup(sampleIndex = 0): Snapshot {
  const snap = emptySnapshot();
  const s = SAMPLES[sampleIndex]!;
  const created = createCollection({ title: s.title, verses: s.verses, translation: s.translation, source: "bundled" }, T0);
  snap.collections.push(created.collection);
  snap.segments.push(...created.segments);
  snap.cards.push(...created.cards);
  return snap;
}

/** Studies everything in the queue at `now`, answering with `rate`. Returns number of answers. */
function studyDay(snap: Snapshot, now: number, rate: (face: ReturnType<typeof cardFace>) => "again" | "good" = () => "good"): number {
  let t = now;
  let answers = 0;
  for (let guard = 0; guard < 200; guard++) {
    const q = buildQueue(snap, t);
    const next = q.now[0] ?? (q.later[0] && q.later[0].due - t < 30 * 60_000 ? q.later[0] : undefined);
    if (!next) break;
    t = Math.max(t, next.due) + 5_000;
    applyReview(snap, next.card.id, rate(cardFace(snap, next.card)), t, 4_000);
    answers++;
  }
  return answers;
}

describe("collections", () => {
  it("creates a segment per chunk and three cards per segment, only stage 1 active", () => {
    const snap = setup();
    expect(snap.collections[0]!.kind).toBe("verse");
    expect(snap.segments.map((s) => s.part)).toEqual(["a", "b", "c", "d", "e"]);
    expect(snap.cards).toHaveLength(15);
    expect(snap.cards.filter((c) => c.unlockedAt !== null).every((c) => c.stage === 1)).toBe(true);
    expect(new Set(snap.cards.map((c) => c.ankiCardId)).size).toBe(15);
  });

  it("renders stage prompts with context", () => {
    const snap = setup();
    const card = snap.cards.find((c) => c.stage === 1 && c.segmentId === snap.segments[2]!.id)!;
    const face = cardFace(snap, card);
    expect(face.reference).toBe("Johannes 3,16c");
    expect(face.context).toEqual(["Also hat Gott die Welt geliebt,", "daß er seinen eingebornen Sohn gab,"]);
    expect(face.prompt).toBe("au_ da_ all_, di_ a_ ih_ glaube_,");
  });
});

describe("queue", () => {
  it("offers only stage 1 on day one, limited by the new-per-day setting", () => {
    const snap = setup(1); // Psalm 23 → many segments
    const q = buildQueue(snap, T0);
    expect(q.now).toHaveLength(DEFAULT_SETTINGS.newSegmentsPerDay);
    expect(q.now.every((s) => s.card.stage === 1)).toBe(true);
  });

  it("brings an 'again' card back in the same session", () => {
    const snap = setup();
    const first = buildQueue(snap, T0).now[0]!;
    applyReview(snap, first.card.id, "again", T0);
    const q = buildQueue(snap, T0 + 2 * 60_000);
    expect(q.now.some((s) => s.card.id === first.card.id)).toBe(true);
  });
});

describe("one stage at a time", () => {
  it("unlocks stage 2 only on a later day and retires stage 1", () => {
    const snap = setup();
    let day = 0;
    let unlockedOn = -1;
    while (day < 60 && unlockedOn < 0) {
      studyDay(snap, T0 + day * DAY);
      if (snap.cards.some((c) => c.stage === 2 && c.unlockedAt !== null)) unlockedOn = day;
      day++;
    }
    expect(unlockedOn).toBeGreaterThan(0);
    const stage2 = snap.cards.filter((c) => c.stage === 2 && c.unlockedAt !== null);
    for (const c2 of stage2) {
      const c1 = snap.cards.find((c) => c.segmentId === c2.segmentId && c.stage === 1)!;
      expect(c1.retiredAt).not.toBeNull();
      expect(c2.unlockedAt).toBe(nextDayStart(c1.retiredAt!, DEFAULT_SETTINGS.dayStartHour));
    }
  });

  it("never schedules two stages of the same segment on one day", () => {
    const snap = setup(1);
    for (let day = 0; day < 120; day++) {
      const q = buildQueue(snap, T0 + day * DAY);
      const segs = q.now.map((s) => s.card.segmentId);
      expect(new Set(segs).size).toBe(segs.length);
      studyDay(snap, T0 + day * DAY);
    }
    // after four months of daily "good", John-style progression reaches stage 3 everywhere
    const prog = collectionProgress(snap, snap.collections[0]!.id, T0 + 120 * DAY);
    expect(prog.verses.every((v) => v.stage === 3)).toBe(true);
    expect(overview(snap, T0 + 120 * DAY).safeVerses).toBeGreaterThan(0);
  });

  it("offers the previous stage as help after two 'again' in a row", () => {
    const snap = setup();
    for (let day = 0; day < 60 && !snap.cards.some((c) => c.stage === 2 && c.unlockedAt !== null); day++) studyDay(snap, T0 + day * DAY);
    const c2 = snap.cards.find((c) => c.stage === 2 && c.unlockedAt !== null)!;
    const t = c2.unlockedAt! + 3_600_000;
    applyReview(snap, c2.id, "again", t);
    expect(fallbackCandidate(snap, c2.id)).toBeNull();
    applyReview(snap, c2.id, "again", t + 11 * 60_000);
    expect(fallbackCandidate(snap, c2.id)?.stage).toBe(1);
  });
});
