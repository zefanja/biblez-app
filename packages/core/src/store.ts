// SQLite persistence behind a tiny driver interface, so the same code runs on
// sql.js (web, tests) and the Capacitor SQLite plugin (iOS/Android).

import { emptySnapshot, type CreatedCollection, type Snapshot } from "./engine";
import { DEFAULT_SETTINGS, type Card, type Collection, type Review, type Segment, type Settings } from "./model";

export type SqlValue = string | number | null;

export interface Statement {
  sql: string;
  params?: SqlValue[];
}

/**
 * Asynchronous so that native plugins (one bridge call per operation) fit.
 * `batch` runs all statements in one transaction: all or nothing.
 */
export interface SqlDriver {
  run(sql: string, params?: SqlValue[]): Promise<void>;
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  batch(statements: Statement[]): Promise<void>;
}

const st = (sql: string, params: SqlValue[] = []): Statement => ({ sql, params });

export const SCHEMA_VERSION = 2;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS collection (id TEXT PRIMARY KEY, title TEXT NOT NULL, kind TEXT NOT NULL, translation TEXT, source TEXT NOT NULL, learn_reference INTEGER NOT NULL, created_at INTEGER NOT NULL, anki_deck_id INTEGER NOT NULL, anki_notetype_id INTEGER)`,
  `CREATE TABLE IF NOT EXISTS segment (id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collection(id) ON DELETE CASCADE, position INTEGER NOT NULL, verse_number TEXT NOT NULL, part TEXT NOT NULL, text TEXT NOT NULL, anki_note_id INTEGER NOT NULL, anki_guid TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS card (id TEXT PRIMARY KEY, segment_id TEXT NOT NULL REFERENCES segment(id) ON DELETE CASCADE, stage INTEGER NOT NULL, anki_card_id INTEGER NOT NULL, unlocked_at INTEGER, retired_at INTEGER)`,
  `CREATE TABLE IF NOT EXISTS review (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES card(id) ON DELETE CASCADE, reviewed_at INTEGER NOT NULL, rating TEXT NOT NULL, duration_ms INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS ix_segment_collection ON segment(collection_id)`,
  `CREATE INDEX IF NOT EXISTS ix_card_segment ON card(segment_id)`,
  `CREATE INDEX IF NOT EXISTS ix_review_card ON review(card_id)`,
];

export async function initSchema(db: SqlDriver): Promise<void> {
  await db.run("PRAGMA foreign_keys = ON");
  await db.batch(SCHEMA.map((sql) => st(sql)));
  // v2: databases created by v1 lack collection.anki_notetype_id
  const columns = await db.all<{ name: string }>("PRAGMA table_info(collection)");
  const migrations: Statement[] = [];
  if (!columns.some((c) => c.name === "anki_notetype_id")) migrations.push(st("ALTER TABLE collection ADD COLUMN anki_notetype_id INTEGER"));
  migrations.push(st("INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)", [String(SCHEMA_VERSION)]));
  await db.batch(migrations);
}

type Row = Record<string, SqlValue>;
const num = (v: SqlValue | undefined) => Number(v);
const optNum = (v: SqlValue | undefined) => (v === null || v === undefined ? null : Number(v));

export async function loadSnapshot(db: SqlDriver): Promise<Snapshot> {
  const snap = emptySnapshot();
  const [collections, segments, cards, reviews] = await Promise.all([
    db.all<Row>("SELECT * FROM collection ORDER BY created_at"),
    db.all<Row>("SELECT * FROM segment ORDER BY collection_id, position"),
    db.all<Row>("SELECT * FROM card"),
    db.all<Row>("SELECT * FROM review ORDER BY reviewed_at"),
  ]);
  snap.collections = collections.map((r) => ({
    id: String(r.id), title: String(r.title), kind: r.kind === "verse" ? "verse" : "passage",
    translation: r.translation === null || r.translation === undefined ? null : String(r.translation), source: r.source === "bundled" ? "bundled" : "custom",
    learnReference: num(r.learn_reference) === 1, createdAt: num(r.created_at), ankiDeckId: num(r.anki_deck_id),
    ankiNotetypeId: optNum(r.anki_notetype_id),
  }));
  snap.segments = segments.map((r) => ({
    id: String(r.id), collectionId: String(r.collection_id), position: num(r.position), verseNumber: String(r.verse_number),
    part: String(r.part), text: String(r.text), ankiNoteId: num(r.anki_note_id), ankiGuid: String(r.anki_guid),
  }));
  snap.cards = cards.map((r) => ({
    id: String(r.id), segmentId: String(r.segment_id), stage: num(r.stage) as Card["stage"], ankiCardId: num(r.anki_card_id),
    unlockedAt: optNum(r.unlocked_at), retiredAt: optNum(r.retired_at),
  }));
  snap.reviews = reviews.map((r) => ({
    id: String(r.id), cardId: String(r.card_id), reviewedAt: num(r.reviewed_at), rating: r.rating === "again" ? "again" : "good",
    durationMs: num(r.duration_ms),
  }));
  return snap;
}

function collectionStatements(created: CreatedCollection): Statement[] {
  const c: Collection = created.collection;
  return [
    st("INSERT INTO collection (id, title, kind, translation, source, learn_reference, created_at, anki_deck_id, anki_notetype_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [c.id, c.title, c.kind, c.translation, c.source, c.learnReference ? 1 : 0, c.createdAt, c.ankiDeckId, c.ankiNotetypeId ?? null]),
    ...created.segments.map((s: Segment) =>
      st("INSERT INTO segment VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [s.id, s.collectionId, s.position, s.verseNumber, s.part, s.text, s.ankiNoteId, s.ankiGuid])),
    ...cardStatements(created.cards),
  ];
}

const cardStatements = (cards: Card[]) =>
  cards.map((k) => st("INSERT OR REPLACE INTO card VALUES (?, ?, ?, ?, ?, ?)", [k.id, k.segmentId, k.stage, k.ankiCardId, k.unlockedAt, k.retiredAt]));
const reviewStatement = (r: Review) => st("INSERT INTO review VALUES (?, ?, ?, ?, ?)", [r.id, r.cardId, r.reviewedAt, r.rating, r.durationMs]);

export async function saveCollection(db: SqlDriver, created: CreatedCollection): Promise<void> {
  await db.batch(collectionStatements(created));
}

export async function saveCards(db: SqlDriver, cards: Card[]): Promise<void> {
  if (cards.length) await db.batch(cardStatements(cards));
}

/** Stores a review together with the cards it changed (unlock/retire) atomically. */
export async function saveReview(db: SqlDriver, r: Review, changedCards: Card[] = []): Promise<void> {
  await db.batch([reviewStatement(r), ...cardStatements(changedCards)]);
}

/** Stores imported collections and their review history in one transaction. */
export async function saveImport(db: SqlDriver, created: CreatedCollection[], reviews: Review[]): Promise<void> {
  await db.batch([...created.flatMap(collectionStatements), ...reviews.map(reviewStatement)]);
}

export async function deleteCollection(db: SqlDriver, collectionId: string): Promise<void> {
  await db.batch([
    st("DELETE FROM review WHERE card_id IN (SELECT card.id FROM card JOIN segment ON segment.id = card.segment_id WHERE segment.collection_id = ?)", [collectionId]),
    st("DELETE FROM card WHERE segment_id IN (SELECT id FROM segment WHERE collection_id = ?)", [collectionId]),
    st("DELETE FROM segment WHERE collection_id = ?", [collectionId]),
    st("DELETE FROM collection WHERE id = ?", [collectionId]),
  ]);
}

export async function loadMeta<T>(db: SqlDriver, key: string, fallback: T): Promise<T> {
  const row = (await db.all<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]))[0];
  if (!row) return fallback;
  try {
    return { ...fallback, ...(JSON.parse(row.value) as Partial<T>) };
  } catch {
    return fallback;
  }
}

export async function saveMeta(db: SqlDriver, key: string, value: unknown): Promise<void> {
  await db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", [key, JSON.stringify(value)]);
}

export const loadSettings = (db: SqlDriver): Promise<Settings> => loadMeta(db, "settings", { ...DEFAULT_SETTINGS });
export const saveSettings = (db: SqlDriver, settings: Settings): Promise<void> => saveMeta(db, "settings", settings);

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

/** Replaces all data with the backup's content (one transaction). */
export async function restoreBackup(db: SqlDriver, backup: Backup): Promise<void> {
  const snap = backup.snapshot;
  const segOf = new Map(snap.segments.map((s) => [s.id, s.collectionId]));
  await db.batch([
    st("DELETE FROM review"),
    st("DELETE FROM card"),
    st("DELETE FROM segment"),
    st("DELETE FROM collection"),
    ...snap.collections.flatMap((c) =>
      collectionStatements({
        collection: c,
        segments: snap.segments.filter((s) => s.collectionId === c.id),
        cards: snap.cards.filter((k) => segOf.get(k.segmentId) === c.id),
      })),
    ...snap.reviews.map(reviewStatement),
    st("INSERT OR REPLACE INTO meta (key, value) VALUES ('settings', ?)", [JSON.stringify({ ...DEFAULT_SETTINGS, ...backup.settings })]),
  ]);
}

/** True when the database holds no collections (used for one-time migrations). */
export async function isEmpty(db: SqlDriver): Promise<boolean> {
  const rows = await db.all<{ n: number }>("SELECT COUNT(*) AS n FROM collection");
  return Number(rows[0]?.n ?? 0) === 0;
}
