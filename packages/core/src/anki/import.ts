// Import of Bible Memorizer cards (Anki add-on) *with their learning history*
// from an Anki export (.apkg/.colpkg). Reads both package formats:
//   - collection.anki21b: current format, zstd-compressed SQLite, schema 18
//   - collection.anki21 / collection.anki2: "support older Anki versions", schema 11
//
// Mapping (product brief §6 / CLAUDE.md rules):
//   note → segment, keeping the Anki note id and GUID (a later export updates the same notes)
//   Card 1 / 2 / 4 → stage 1 / 2 / 3, keeping the Anki card ids; Card 3 (table) is dropped
//   revlog → reviews: again stays again, hard/good/easy become good; a reset ("forget")
//   discards the history before it. Card state is then derived by replay(), as everywhere.
//   Anki had all stages active at once; BibleZ keeps the highest stage already
//   studied active and lets the lower ones rest (one stage at a time).

import { unzipSync } from "fflate";
import { decompress } from "fzstd";
import type { Database, SqlJsStatic } from "sql.js";
import type { CreatedCollection } from "../engine";
import { nextAnkiId, uid } from "../ids";
import { DEFAULT_SETTINGS, STAGES, type Card, type Collection, type Review, type Segment, type Settings, type Stage } from "../model";

export interface AnkiImportOptions {
  now?: number;
  settings?: Settings;
  /** GUIDs already in BibleZ: those notes are skipped (re-import does not duplicate). */
  existingGuids?: Set<string>;
}

export interface AnkiImportReport {
  format: "anki21b" | "anki21" | "anki2";
  collections: { title: string; segments: number; reviews: number }[];
  segments: number;
  reviews: number;
  skippedDuplicates: number;
  /** Notes of other note types (not from the Bible Memorizer add-on). */
  ignoredNotes: number;
  /** Overview-table cards (Card 3) – BibleZ has no table. */
  ignoredTableCards: number;
}

export interface AnkiImportResult {
  created: CreatedCollection[];
  reviews: Review[];
  report: AnkiImportReport;
}

export class AnkiImportError extends Error {
  constructor(public readonly code: "not_anki" | "no_bible_memorizer_notes" | "nothing_new") {
    super(code);
  }
}

const REQUIRED_FIELDS = ["answer", "verse_number", "verse_part", "title"];
const ORD_TO_STAGE: Record<number, Stage> = { 0: 1, 1: 2, 3: 3 };
const TABLE_ORD = 2;

type Row = Record<string, unknown>;

function rows(db: Database, sql: string, params: (string | number)[] = []): Row[] {
  const res = db.exec(sql, params)[0];
  if (!res) return [];
  return res.values.map((v) => Object.fromEntries(res.columns.map((c, i) => [c, v[i]])));
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
export function cleanField(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1]!.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/\s+/g, " ")
    .trim();
}

/** Opens the collection inside the package, preferring the newest format. */
function openCollection(SQL: SqlJsStatic, bytes: Uint8Array): { db: Database; format: AnkiImportReport["format"] } {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new AnkiImportError("not_anki");
  }
  if (files["collection.anki21b"]) {
    let db = new SQL.Database(decompress(files["collection.anki21b"]));
    // Schema 18 declares Anki's own "unicase" collation, which sql.js does not know.
    // Drop it from this in-memory copy (reading does not depend on it) and reopen.
    db.exec("PRAGMA writable_schema=ON; UPDATE sqlite_master SET sql = replace(sql, 'COLLATE unicase', '') WHERE sql LIKE '%unicase%'; PRAGMA writable_schema=OFF;");
    db = new SQL.Database(db.export());
    db.exec("REINDEX");
    return { db, format: "anki21b" };
  }
  if (files["collection.anki21"]) return { db: new SQL.Database(files["collection.anki21"]), format: "anki21" };
  if (files["collection.anki2"]) return { db: new SQL.Database(files["collection.anki2"]), format: "anki2" };
  throw new AnkiImportError("not_anki");
}

/** Note types whose fields look like the add-on's: id → field names in order. */
function bibleNotetypes(db: Database): Map<number, string[]> {
  const found = new Map<number, string[]>();
  const tables = new Set(rows(db, "SELECT name FROM sqlite_master WHERE type = 'table'").map((r) => String(r.name)));
  if (tables.has("notetypes")) {
    const fields = new Map<number, string[]>();
    for (const r of rows(db, "SELECT ntid, ord, name FROM fields ORDER BY ntid, ord")) {
      const id = Number(r.ntid);
      fields.set(id, [...(fields.get(id) ?? []), String(r.name)]);
    }
    for (const [id, names] of fields) if (REQUIRED_FIELDS.every((f) => names.includes(f))) found.set(id, names);
  } else {
    const col = rows(db, "SELECT models FROM col")[0];
    const models = JSON.parse(String(col?.models ?? "{}")) as Record<string, { id: number; flds: { name: string; ord: number }[] }>;
    for (const m of Object.values(models)) {
      const names = [...m.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name);
      if (REQUIRED_FIELDS.every((f) => names.includes(f))) found.set(Number(m.id), names);
    }
  }
  return found;
}

/** The add-on's sort field "id" is "<creation ms>-<index>". */
function sortKey(idField: string, noteId: number): [number, number] {
  const m = idField.match(/^(\d+)-(\d+)$/);
  return m ? [Number(m[1]), Number(m[2])] : [noteId, 0];
}

interface RevlogRow {
  id: number;
  cid: number;
  ease: number;
  ivl: number;
  type: number;
  time: number;
}

/** Anki revlog → BibleZ reviews for one card. */
function convertRevlog(entries: RevlogRow[], cardId: string, usedIds: Set<string>): Review[] {
  let reviews: Review[] = [];
  for (const e of entries.sort((a, b) => a.id - b.id)) {
    if (e.ease === 0) {
      // manual entry: a reset ("forget", ivl 0) starts the card from scratch;
      // other manual changes (set due date, reschedule) leave the history as it is
      if (e.type === 4 && e.ivl === 0) reviews = [];
      continue;
    }
    let id = uid(e.id);
    while (usedIds.has(id)) id = uid(e.id);
    usedIds.add(id);
    reviews.push({ id, cardId, reviewedAt: e.id, rating: e.ease === 1 ? "again" : "good", durationMs: Math.max(0, Math.min(e.time, 600_000)) });
  }
  return reviews;
}

export function importAnkiPackage(SQL: SqlJsStatic, bytes: Uint8Array, options: AnkiImportOptions = {}): AnkiImportResult {
  const now = options.now ?? Date.now();
  const settings = options.settings ?? DEFAULT_SETTINGS;
  const existing = options.existingGuids ?? new Set<string>();
  const { db, format } = openCollection(SQL, bytes);
  try {
    const notetypes = bibleNotetypes(db);
    const allNotes = rows(db, "SELECT id, mid, guid, flds FROM notes ORDER BY id");
    const notes = allNotes.filter((n) => notetypes.has(Number(n.mid)));
    if (!notes.length) throw new AnkiImportError("no_bible_memorizer_notes");

    const report: AnkiImportReport = {
      format, collections: [], segments: 0, reviews: 0, skippedDuplicates: 0,
      ignoredNotes: allNotes.length - notes.length, ignoredTableCards: 0,
    };

    // cards and revlog of the relevant notes
    const noteIds = new Set(notes.map((n) => Number(n.id)));
    const cardsByNote = new Map<number, Row[]>();
    for (const c of rows(db, "SELECT id, nid, ord FROM cards")) {
      const nid = Number(c.nid);
      if (noteIds.has(nid)) cardsByNote.set(nid, [...(cardsByNote.get(nid) ?? []), c]);
    }
    const revlogByCard = new Map<number, RevlogRow[]>();
    for (const r of rows(db, "SELECT id, cid, ease, ivl, type, time FROM revlog")) {
      const e = { id: Number(r.id), cid: Number(r.cid), ease: Number(r.ease), ivl: Number(r.ivl), type: Number(r.type), time: Number(r.time) };
      revlogByCard.set(e.cid, [...(revlogByCard.get(e.cid) ?? []), e]);
    }

    // group notes by title, in the add-on's order
    type Parsed = { id: number; mid: number; guid: string; f: Record<string, string>; key: [number, number] };
    const groups = new Map<string, Parsed[]>();
    for (const n of notes) {
      const names = notetypes.get(Number(n.mid))!;
      const values = String(n.flds).split("\x1f");
      const f = Object.fromEntries(names.map((name, i) => [name, values[i] ?? ""]));
      const title = cleanField(f.title ?? "") || "Anki";
      const parsed = { id: Number(n.id), mid: Number(n.mid), guid: String(n.guid), f, key: sortKey(cleanField(f.id ?? ""), Number(n.id)) };
      groups.set(title, [...(groups.get(title) ?? []), parsed]);
    }

    const created: CreatedCollection[] = [];
    const allReviews: Review[] = [];
    const usedReviewIds = new Set<string>();

    for (const [title, group] of groups) {
      group.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.id - b.id);
      const fresh = group.filter((n) => !existing.has(n.guid));
      report.skippedDuplicates += group.length - fresh.length;
      if (!fresh.length) continue;

      const createdAt = Math.min(...fresh.map((n) => n.key[0]));
      const verseNumbers = fresh.map((n) => cleanField(n.f.verse_number ?? "") || "1");
      const allZero = verseNumbers.every((v) => v === "0");
      const collection: Collection = {
        id: uid(createdAt),
        title,
        kind: new Set(verseNumbers).size === 1 ? "verse" : "passage",
        translation: null,
        source: "custom",
        learnReference: true,
        createdAt,
        ankiDeckId: nextAnkiId(now),
        ankiNotetypeId: fresh[0]!.mid,
      };
      const segments: Segment[] = [];
      const cards: Card[] = [];
      let collectionReviews = 0;

      fresh.forEach((n, position) => {
        const verseNumber = allZero ? "1" : verseNumbers[position]!;
        let text = cleanField(n.f.answer ?? "");
        const prefix = new RegExp(`^${verseNumber.replace(/[^\w]/g, "\\$&")}\\s+`);
        if (prefix.test(text)) text = text.replace(prefix, "");
        const segment: Segment = {
          id: uid(createdAt), collectionId: collection.id, position, verseNumber,
          part: cleanField(n.f.verse_part ?? "") || "a", text, ankiNoteId: n.id, ankiGuid: n.guid,
        };
        segments.push(segment);

        // one card per stage, with the Anki card id where Anki had generated it
        const ankiCards = cardsByNote.get(n.id) ?? [];
        report.ignoredTableCards += ankiCards.filter((c) => Number(c.ord) === TABLE_ORD).length;
        const perStage = new Map<Stage, { card: Card; reviews: Review[] }>();
        for (const stage of STAGES) {
          const anki = ankiCards.find((c) => ORD_TO_STAGE[Number(c.ord)] === stage);
          const card: Card = { id: uid(createdAt), segmentId: segment.id, stage, ankiCardId: anki ? Number(anki.id) : nextAnkiId(now), unlockedAt: null, retiredAt: null };
          const reviews = anki ? convertRevlog(revlogByCard.get(Number(anki.id)) ?? [], card.id, usedReviewIds) : [];
          perStage.set(stage, { card, reviews });
        }

        // one stage at a time: the highest stage already studied stays active
        const studied = STAGES.filter((s) => perStage.get(s)!.reviews.length > 0);
        const active: Stage = studied.length ? studied[studied.length - 1]! : 1;
        for (const stage of STAGES) {
          const { card, reviews } = perStage.get(stage)!;
          const firstReview = reviews[0]?.reviewedAt ?? null;
          if (settings.allStagesAtOnce) {
            card.unlockedAt = firstReview ?? now;
          } else if (stage < active) {
            card.unlockedAt = firstReview ?? createdAt;
            card.retiredAt = now;
          } else if (stage === active) {
            card.unlockedAt = firstReview ?? now;
          }
          cards.push(card);
          allReviews.push(...reviews);
          collectionReviews += reviews.length;
        }
      });

      created.push({ collection, segments, cards });
      report.collections.push({ title, segments: segments.length, reviews: collectionReviews });
      report.segments += segments.length;
      report.reviews += collectionReviews;
    }

    if (!created.length) throw new AnkiImportError("nothing_new");
    return { created, reviews: allReviews, report };
  } finally {
    db.close();
  }
}
