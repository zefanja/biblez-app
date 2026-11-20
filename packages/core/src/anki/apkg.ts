// Anki export (legacy .apkg: collection.anki2, schema 11) including the full
// review history and the FSRS memory state of every card.
//
// Encoding verified against Anki 26.09 (see tools/anki_verify.py):
//   cards.data = {"s":stability,"d":difficulty,"dr":retention,"decay":…,"lrt":lastReviewSec}
//   review cards: due = day number relative to col.crt (importer re-bases it)
//   learning cards: due = epoch seconds, revlog.ivl = negative seconds
//   resting (retired) stages: queue = -1 (suspended)

import { zipSync, strToU8 } from "fflate";
import type { Database, SqlJsStatic } from "sql.js";
import { FSRS6_DEFAULT_DECAY } from "ts-fsrs";
import type { Snapshot } from "../engine";
import { DEFAULT_SETTINGS, type Card, type Collection, type Segment, type Settings } from "../model";
import { segmentsOf } from "../render";
import { dayStart, daysBetween } from "../scheduler/day";
import { replay, State, type ReplayStep } from "../scheduler/fsrs";
import { firstLetters, maskLastLetters } from "../text/words";
import { FIELD_NAMES, NOTETYPE_ID, notetypeJson, SORT_FIELD_INDEX, type FieldName } from "./notetype";
import { sha1Hex } from "./sha1";

export const ROOT_DECK_NAME = "BibleZ";
const ROOT_DECK_ID = 1731000000002;
const CONTEXT_LINES = 2;

export interface ExportOptions {
  /** Limit the export to these collections (default: all). */
  collectionIds?: string[];
  now?: number;
  settings?: Settings;
}

export interface ExportResult {
  bytes: Uint8Array;
  noteCount: number;
  cardCount: number;
  reviewCount: number;
}

// ------------------------------------------------------------------ fields

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The add-on puts the verse number in front of the first line of a verse. */
function answerLine(seg: Segment): string {
  return escapeHtml(seg.part === "a" ? `${seg.verseNumber} ${seg.text}` : seg.text);
}

export function noteFields(collection: Collection, segments: Segment[], index: number): Record<FieldName, string> {
  const seg = segments[index]!;
  const prev = segments.slice(Math.max(0, index - CONTEXT_LINES), index);
  const next = segments.slice(index, index + CONTEXT_LINES);
  return {
    answer: answerLine(seg),
    verse_number: seg.verseNumber,
    verse_part: seg.part,
    table: "", // overview table is not offered (product decision), so Card 3 is never generated
    front: prev.length ? prev.map((s) => `${answerLine(s)}<br>`).join("") : "[Beginning]",
    back: next.map((s) => `${answerLine(s)}<br>`).join(""),
    first_letters: escapeHtml(firstLetters(seg.text)),
    last_letters: escapeHtml(maskLastLetters(seg.text)),
    title: escapeHtml(collection.title),
    id: `${collection.createdAt}-${String(index).padStart(4, "0")}`,
  };
}

/** Anki ord of each stage: stage 1 → Card 1, stage 2 → Card 2, stage 3 → Card 4. */
const STAGE_ORD = { 1: 0, 2: 1, 3: 3 } as const;

// ------------------------------------------------------------------ schema

const SCHEMA_SQL = `
CREATE TABLE col (id integer PRIMARY KEY, crt integer NOT NULL, mod integer NOT NULL, scm integer NOT NULL, ver integer NOT NULL, dty integer NOT NULL, usn integer NOT NULL, ls integer NOT NULL, conf text NOT NULL, models text NOT NULL, decks text NOT NULL, dconf text NOT NULL, tags text NOT NULL);
CREATE TABLE notes (id integer PRIMARY KEY, guid text NOT NULL, mid integer NOT NULL, mod integer NOT NULL, usn integer NOT NULL, tags text NOT NULL, flds text NOT NULL, sfld integer NOT NULL, csum integer NOT NULL, flags integer NOT NULL, data text NOT NULL);
CREATE TABLE cards (id integer PRIMARY KEY, nid integer NOT NULL, did integer NOT NULL, ord integer NOT NULL, mod integer NOT NULL, usn integer NOT NULL, type integer NOT NULL, queue integer NOT NULL, due integer NOT NULL, ivl integer NOT NULL, factor integer NOT NULL, reps integer NOT NULL, lapses integer NOT NULL, left integer NOT NULL, odue integer NOT NULL, odid integer NOT NULL, flags integer NOT NULL, data text NOT NULL);
CREATE TABLE revlog (id integer PRIMARY KEY, cid integer NOT NULL, usn integer NOT NULL, ease integer NOT NULL, ivl integer NOT NULL, lastIvl integer NOT NULL, factor integer NOT NULL, time integer NOT NULL, type integer NOT NULL);
CREATE TABLE graves (usn integer NOT NULL, oid integer NOT NULL, type integer NOT NULL);
CREATE INDEX ix_notes_csum ON notes (csum);
CREATE INDEX ix_notes_usn ON notes (usn);
CREATE INDEX ix_cards_usn ON cards (usn);
CREATE INDEX ix_cards_nid ON cards (nid);
CREATE INDEX ix_cards_sched ON cards (did, queue, due);
CREATE INDEX ix_revlog_usn ON revlog (usn);
CREATE INDEX ix_revlog_cid ON revlog (cid);
`;

function deckJson(id: number, name: string, nowSec: number) {
  return {
    id, name, mod: nowSec, usn: -1, desc: "", dyn: 0, conf: 1, collapsed: false, browserCollapsed: false,
    extendNew: 0, extendRev: 0, lrnToday: [0, 0], revToday: [0, 0], newToday: [0, 0], timeToday: [0, 0],
  };
}

function defaultDeckConfig() {
  return {
    1: {
      id: 1, mod: 0, name: "Default", usn: 0, maxTaken: 60, autoplay: true, timer: 0, replayq: true, dyn: false,
      new: { bury: true, delays: [1, 10], initialFactor: 2500, ints: [1, 4, 0], order: 1, perDay: 20 },
      rev: { bury: true, ease4: 1.3, ivlFct: 1, maxIvl: 36500, perDay: 200, hardFactor: 1.2 },
      lapse: { delays: [10], leechAction: 1, leechFails: 8, minInt: 1, mult: 0 },
    },
  };
}

// ------------------------------------------------------------------ export

const revlogType = (s: State) => (s === State.Review ? 1 : s === State.Relearning ? 2 : 0);
const revlogIvl = (step: ReplayStep) =>
  step.after.state === State.Review
    ? Math.max(1, step.after.scheduled_days)
    : -Math.max(1, Math.round((step.after.due.getTime() - step.review.reviewedAt) / 1000));

export function buildAnkiCollection(SQL: SqlJsStatic, snapshot: Snapshot, options: ExportOptions = {}): { db: Database; noteCount: number; cardCount: number; reviewCount: number } {
  const now = options.now ?? Date.now();
  const settings = options.settings ?? DEFAULT_SETTINGS;
  const nowSec = Math.floor(now / 1000);
  // crt = start of today, so "today" in the exported collection is day 0.
  const crtMs = dayStart(now, settings.dayStartHour);
  const collections = snapshot.collections.filter((c) => !options.collectionIds || options.collectionIds.includes(c.id));

  const db = new SQL.Database();
  db.exec(SCHEMA_SQL);

  const decks: Record<string, unknown> = { 1: deckJson(1, "Default", 0), [ROOT_DECK_ID]: deckJson(ROOT_DECK_ID, ROOT_DECK_NAME, nowSec) };
  for (const c of collections) decks[c.ankiDeckId] = deckJson(c.ankiDeckId, `${ROOT_DECK_NAME}::${c.title}`, nowSec);
  const firstDeck = collections[0]?.ankiDeckId ?? ROOT_DECK_ID;
  const conf = { activeDecks: [firstDeck], curDeck: firstDeck, curModel: NOTETYPE_ID, nextPos: 1, sortType: "noteFld", sortBackwards: false, addToCur: true, dayLearnFirst: false, schedVer: 2, rollover: settings.dayStartHour, collapseTime: 1200, estTimes: true, dueCounts: true, newSpread: 0, timeLim: 0 };
  db.run("INSERT INTO col VALUES (1, ?, ?, ?, 11, 0, 0, 0, ?, ?, ?, ?, '{}')", [
    Math.floor(crtMs / 1000), now, now, JSON.stringify(conf),
    JSON.stringify({ [NOTETYPE_ID]: notetypeJson(firstDeck, nowSec) }), JSON.stringify(decks), JSON.stringify(defaultDeckConfig()),
  ]);

  const insNote = db.prepare("INSERT INTO notes VALUES (?, ?, ?, ?, -1, ' BibleZ ', ?, ?, ?, 0, '')");
  const insCard = db.prepare("INSERT INTO cards VALUES (?, ?, ?, ?, ?, -1, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?)");
  const insRev = db.prepare("INSERT INTO revlog VALUES (?, ?, -1, ?, ?, ?, ?, ?, ?)");

  let noteCount = 0;
  let cardCount = 0;
  let reviewCount = 0;
  let newPosition = 0;
  type RevlogRow = [id: number, cid: number, ease: number, ivl: number, lastIvl: number, factor: number, time: number, type: number];
  const revlogRows: RevlogRow[] = [];
  const cardsBySegment = new Map<string, Card[]>();
  for (const card of snapshot.cards) cardsBySegment.set(card.segmentId, [...(cardsBySegment.get(card.segmentId) ?? []), card]);
  const reviewsByCard = new Map<string, typeof snapshot.reviews>();
  for (const r of snapshot.reviews) reviewsByCard.set(r.cardId, [...(reviewsByCard.get(r.cardId) ?? []), r]);

  for (const collection of collections) {
    const segments = segmentsOf(snapshot, collection.id);
    segments.forEach((seg, index) => {
      const fields = noteFields(collection, segments, index);
      const flds = FIELD_NAMES.map((f) => fields[f]).join("\x1f");
      const csum = parseInt(sha1Hex(fields.answer.replace(/<[^>]*>/g, "")).slice(0, 8), 16);
      insNote.run([seg.ankiNoteId, seg.ankiGuid, NOTETYPE_ID, nowSec, flds, fields[FIELD_NAMES[SORT_FIELD_INDEX]!], csum]);
      noteCount++;

      for (const card of (cardsBySegment.get(seg.id) ?? []).sort((a, b) => a.stage - b.stage)) {
        const reviews = reviewsByCard.get(card.id) ?? [];
        const { card: st, steps } = replay(reviews, settings.desiredRetention, card.unlockedAt ?? collection.createdAt);
        const suspended = card.retiredAt !== null;
        let type = 0, queue = 0, due = 0, ivl = 0, factor = 0, left = 0, data = "";
        if (steps.length === 0) {
          due = ++newPosition;
        } else {
          data = JSON.stringify({
            s: Math.round(st.stability * 10000) / 10000,
            d: Math.round(st.difficulty * 1000) / 1000,
            dr: settings.desiredRetention,
            decay: FSRS6_DEFAULT_DECAY,
            lrt: Math.floor((st.last_review?.getTime() ?? now) / 1000),
          });
          if (st.state === State.Review) {
            type = 2; queue = 2; ivl = Math.max(1, st.scheduled_days); factor = 2500;
            due = daysBetween(crtMs, st.due.getTime(), settings.dayStartHour);
          } else {
            type = st.state === State.Relearning ? 3 : 1; queue = 1;
            due = Math.floor(st.due.getTime() / 1000);
            left = st.state === State.Relearning ? 1 : Math.max(1, 2 - st.learning_steps);
            factor = st.state === State.Relearning ? 2500 : 0;
          }
          let lastIvl = 0;
          for (const step of steps) {
            const thisIvl = revlogIvl(step);
            revlogRows.push([step.review.reviewedAt, card.ankiCardId, step.review.rating === "again" ? 1 : 3, thisIvl, lastIvl,
              Math.round(step.after.difficulty * 100), Math.min(60_000, step.review.durationMs), revlogType(step.before.state)]);
            lastIvl = thisIvl;
          }
        }
        if (suspended) queue = -1;
        insCard.run([card.ankiCardId, seg.ankiNoteId, collection.ankiDeckId, STAGE_ORD[card.stage], nowSec,
          type, queue, due, ivl, factor, st.reps, st.lapses, left, data]);
        cardCount++;
      }
    });
  }
  // revlog ids are review timestamps (ms) and must be unique: assign them in chronological order.
  revlogRows.sort((a, b) => a[0] - b[0]);
  let lastRevlogId = 0;
  for (const row of revlogRows) {
    row[0] = Math.max(row[0], lastRevlogId + 1);
    lastRevlogId = row[0];
    insRev.run(row);
    reviewCount++;
  }
  insNote.free(); insCard.free(); insRev.free();
  return { db, noteCount, cardCount, reviewCount };
}

/** Builds a complete .apkg file in memory. */
export function exportApkg(SQL: SqlJsStatic, snapshot: Snapshot, options: ExportOptions = {}): ExportResult {
  const { db, noteCount, cardCount, reviewCount } = buildAnkiCollection(SQL, snapshot, options);
  const bytes = db.export();
  db.close();
  const zipped = zipSync({ "collection.anki2": bytes, media: strToU8("{}") }, { level: 6 });
  return { bytes: zipped, noteCount, cardCount, reviewCount };
}
