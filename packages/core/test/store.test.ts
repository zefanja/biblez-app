import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import {
  applyReview, createCollection, initSchema, loadSettings, loadSnapshot, makeBackup, parseBackup, restoreBackup,
  saveCards, saveCollection, saveReview, saveSettings, deleteCollection, SAMPLES, DEFAULT_SETTINGS, type SqlDriver, type SqlValue,
} from "../src";

async function driver(): Promise<SqlDriver> {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  return {
    run: (sql, params = []) => void db.run(sql, params),
    all: <T,>(sql: string, params: SqlValue[] = []) => {
      const res = db.exec(sql, params)[0];
      if (!res) return [] as T[];
      return res.values.map((row) => Object.fromEntries(res.columns.map((c, i) => [c, row[i]]))) as T[];
    },
  };
}

describe("SQLite store", () => {
  it("round-trips collections, cards, reviews and settings", async () => {
    const db = await driver();
    initSchema(db);
    const created = createCollection({ title: "Psalm 23", verses: SAMPLES[1]!.verses });
    saveCollection(db, created);
    let snap = loadSnapshot(db);
    expect(snap.segments).toHaveLength(created.segments.length);
    const res = applyReview(snap, snap.cards.find((c) => c.stage === 1)!.id, "good", Date.now(), 1200);
    saveReview(db, res.review);
    saveCards(db, res.changedCards);
    saveSettings(db, { ...DEFAULT_SETTINGS, newSegmentsPerDay: 3 });
    snap = loadSnapshot(db);
    expect(snap.reviews).toHaveLength(1);
    expect(snap.reviews[0]!.durationMs).toBe(1200);
    expect(loadSettings(db).newSegmentsPerDay).toBe(3);

    const backup = parseBackup(JSON.stringify(makeBackup(snap, loadSettings(db))));
    deleteCollection(db, created.collection.id);
    expect(loadSnapshot(db).collections).toHaveLength(0);
    restoreBackup(db, backup);
    const restored = loadSnapshot(db);
    expect(restored.cards).toHaveLength(snap.cards.length);
    expect(restored.reviews).toEqual(snap.reviews);
  });

  it("rejects foreign files as backup", () => {
    expect(() => parseBackup('{"hello":1}')).toThrow("invalid_backup");
  });
});
