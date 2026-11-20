import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import {
  applyReview, createCollection, deleteCollection, initSchema, isEmpty, loadMeta, loadSettings, loadSnapshot, makeBackup,
  parseBackup, restoreBackup, saveCollection, saveMeta, saveReview, saveSettings, SAMPLES, DEFAULT_SETTINGS, sqlJsDriver,
  type SqlDriver,
} from "../src";

async function driver(): Promise<SqlDriver> {
  const SQL = await initSqlJs();
  const db = sqlJsDriver(new SQL.Database());
  await initSchema(db);
  return db;
}

describe("SQLite store", () => {
  it("round-trips collections, cards, reviews and settings", async () => {
    const db = await driver();
    expect(await isEmpty(db)).toBe(true);
    const created = createCollection({ title: "Psalm 23", verses: SAMPLES[1]!.verses });
    await saveCollection(db, created);
    expect(await isEmpty(db)).toBe(false);
    let snap = await loadSnapshot(db);
    expect(snap.segments).toHaveLength(created.segments.length);
    expect(snap.cards).toHaveLength(created.cards.length);
    const res = applyReview(snap, snap.cards.find((c) => c.stage === 1)!.id, "good", Date.now(), 1200);
    await saveReview(db, res.review, res.changedCards);
    await saveSettings(db, { ...DEFAULT_SETTINGS, newSegmentsPerDay: 3 });
    snap = await loadSnapshot(db);
    expect(snap.reviews).toHaveLength(1);
    expect(snap.reviews[0]!.durationMs).toBe(1200);
    expect((await loadSettings(db)).newSegmentsPerDay).toBe(3);

    const backup = parseBackup(JSON.stringify(makeBackup(snap, await loadSettings(db))));
    await deleteCollection(db, created.collection.id);
    expect((await loadSnapshot(db)).collections).toHaveLength(0);
    await restoreBackup(db, backup);
    const restored = await loadSnapshot(db);
    expect(restored.cards).toHaveLength(snap.cards.length);
    expect(restored.reviews).toEqual(snap.reviews);
  });

  it("rolls a batch back completely when one statement fails", async () => {
    const db = await driver();
    const created = createCollection({ title: "Joh 3,16", verses: SAMPLES[0]!.verses });
    await saveCollection(db, created);
    // the same collection again violates the primary key in the first statement…
    await expect(saveCollection(db, created)).rejects.toThrow();
    // …and nothing of the second attempt is left behind
    expect((await loadSnapshot(db)).segments).toHaveLength(created.segments.length);
  });

  it("stores arbitrary meta values with defaults", async () => {
    const db = await driver();
    expect(await loadMeta(db, "ui", { theme: "auto", lang: "de" })).toEqual({ theme: "auto", lang: "de" });
    await saveMeta(db, "ui", { theme: "dark" });
    expect(await loadMeta(db, "ui", { theme: "auto", lang: "de" })).toEqual({ theme: "dark", lang: "de" });
  });

  it("rejects foreign files as backup", () => {
    expect(() => parseBackup('{"hello":1}')).toThrow("invalid_backup");
  });
});
