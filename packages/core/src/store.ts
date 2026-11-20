// SQLite persistence behind a tiny driver interface, so the same code runs on
// sql.js (web, tests) and the Capacitor SQLite plugin (iOS/Android).

import { emptySnapshot, type CreatedCollection, type Snapshot } from "./engine";
import { DEFAULT_SETTINGS, type Card, type Collection, type Review, type Segment, type Settings } from "./model";

export type SqlValue = string | number | null;

export interface SqlDriver {
  run(sql: string, params?: SqlValue[]): void;
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): T[];
}

export const SCHEMA_VERSION = 1;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS collection (id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL, translation TEXT, source TEXT NOT NULL, learn_reference INTEGER NOT NULL, created_at INTEGER NOT NULL, anki_deck_id INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS segment (id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collection(id) ON DELETE CASCADE, position INTEGER NOT NULL, verse_number TEXT NOT NULL, part TEXT NOT NULL, text TEXT NOT NULL, anki_note_id INTEGER NOT NULL, anki_guid TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS card (id TEXT PRIMARY KEY, segment_id TEXT NOT NULL REFERENCES segment(id) ON DELETE CASCADE, stage INTEGER NOT NULL, anki_card_id INTEGER NOT NULL, unlocked_at INTEGER, retired_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS review (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE, reviewed_at INTEGER NOT NULL, rating TEXT NOT NULL, duration_ms INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ix_segment_collection ON segment(collection_id)`,
  `CREATE INDEX IF NOT EXISTS ix_card_segment ON card(segment_id)`,
  `CREATE INDEX IF NOT EXISTS ix_review_card ON review(card_id)`,
];

export function initSchema(db: SqlDriver): void {
  db.run("PRAGMA foreign_keys = ON");
  for (const stmt of SCHEMA) db.run(stmt);
  db.run("INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', ?)", [String(SCHEMA_VERSION)]);
}

type Row = Record<string, SqlValue>;
const num = (v: SqlValue) => Number(v);
const optNum = (v: SqlValue) => (v === null ? null : Number(v));

export function loadSnapshot(db: SqlDriver): Snapshot {
  const snap = emptySnapshot();
  snap.collections = db.all<Row>("SELECT * FROM collection ORDER BY created_at").map((r) => ({
    id: String(r.id), title: String(r.title), kind: r.kind === "verse" ? "verse" : "passage",
    translation: r.translation === null ? null : String(r.translation), source: r.source === "bundled" ? "bundled" : "custom",
    learnReference: num(r.learn_reference!) === 1, createdAt: num(r.created_at!), ankiDeckId: num(r.anki_deck_id!),
  }));
  snap.segments = db.all<Row>("SELECT * FROM segment ORDER BY collection_id, position").map((r) => ({
    id: String(r.id), collectionId: String(r.collection_id), position: num(r.position!), verseNumber: String(r.verse_number),
    part: String(r.part), text: String(r.text), ankiNoteId: num(r.anki_note_id!), ankiGuid: String(r.anki_guid),
  }));
  snap.cards = db.all<Row>("SELECT * FROM card").map((r) => ({
    id: String(r.id), segmentId: String(r.segment_id), stage: num(r.stage!) as Card["stage"], ankiCardId: num(r.anki_card_id!),
    unlockedAt: optNum(r.unlocked_at!), retiredAt: optNum(r.retired_at!),
  }));
  snap.reviews = db.all<Row>("SELECT * FROM review ORDER BY reviewed_at").map((r) => ({
    id: String(r.id), cardId: String(r.card_id), reviewedAt: num(r.reviewed_at!), rating: r.rating === "again" ? "again" : "good",
    durationMs: num(r.duration_ms!),
  }));
  return snap;
}

export function saveCollection(db: SqlDriver, created: CreatedCollection): void {
  const c: Collection = created.collection;
  db.run("INSERT INTO collection VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [c.id, c.title, c.kind, c.translation, c.source, c.learnReference ? 1 : 0, c.createdAt, c.ankiDeckId]);
  for (const s of created.segments) saveSegment(db, s);
  saveCards(db, created.cards);
}

function saveSegment(db: SqlDriver, s: Segment): void {
  db.run("INSERT INTO segment VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [s.id, s.collectionId, s.position, s.verseNumber, s.part, s.text, s.ankiNoteId, s.ankiGuid]);
}

export function saveCards(db: SqlDriver, cards: Card[]): void {
  for (const k of cards) {
    db.run("INSERT OR REPLACE INTO card VALUES (?, ?, ?, ?, ?, ?)", [k.id, k.segmentId, k.stage, k.ankiCardId, k.unlockedAt, k.retiredAt]);
  }
}

export function saveReview(db: SqlDriver, r: Review): void {
  db.run("INSERT INTO review VALUES (?, ?, ?, ?, ?)", [r.id, r.cardId, r.reviewedAt, r.rating, r.durationMs]);
}

export function deleteCollection(db: SqlDriver, collectionId: string): void {
  db.run("DELETE FROM review WHERE card_id IN (SELECT card.id FROM card JOIN segment ON segment.id = card.segment_id WHERE segment.collection_id = ?)", [collectionId]);
  db.run("DELETE FROM card WHERE segment_id IN (SELECT id FROM segment WHERE collection_id = ?)", [collectionId]);
  db.run("DELETE FROM segment WHERE collection_id = ?", [collectionId]);
  db.run("DELETE FROM collection WHERE id = ?", [collectionId]);
}

export function loadSettings(db: SqlDriver): Settings {
  const row = db.all<{ value: string }>("SELECT value FROM meta WHERE key = 'settings'")[0];
  if (!row) return { ...DEFAULT_SETTINGS };
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(db: SqlDriver, settings: Settings): void {
  db.run("INSERT OR REPLACE INTO meta (key, value) VALUES ('settings', ?)", [JSON.stringify(settings)]);
}

// ------------------------------------------------------------------ backup

export interface Backup {
  format: "biblez-backup";
  version: 1;
  exportedAt: number;
  settings: Settings;
  snapshot: Snapshot;
}

export function makeBackup(snapshot: Snapshot, settings: Settings, now: number = Date.now()): Backup {
  return { format: "biblez-backup", version: 1, exportedAt: now, settings, snapshot };
}

export function parseBackup(json: string): Backup {
  const data = JSON.parse(json) as Partial<Backup>;
  if (data.format !== "biblez-backup" || data.version !== 1 || !data.snapshot) throw new Error("invalid_backup");
  return data as Backup;
}

/** Replaces all data with the backup's content. */
export function restoreBackup(db: SqlDriver, backup: Backup): void {
  db.run("DELETE FROM review");
  db.run("DELETE FROM card");
  db.run("DELETE FROM segment");
  db.run("DELETE FROM collection");
  const snap = backup.snapshot;
  for (const c of snap.collections) {
    saveCollection(db, {
      collection: c,
      segments: snap.segments.filter((s) => s.collectionId === c.id),
      cards: snap.cards.filter((k) => snap.segments.some((s) => s.id === k.segmentId && s.collectionId === c.id)),
    });
  }
  for (const r of snap.reviews) saveReview(db, r);
  saveSettings(db, { ...DEFAULT_SETTINGS, ...backup.settings });
}
