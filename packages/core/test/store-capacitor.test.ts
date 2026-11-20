// Runs the store through the Capacitor SQLite adapter against a fake connection
// that mimics the plugin's semantics (run/query/execute/executeSet, transactions).
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import {
  applyReview, capacitorSqliteDriver, createCollection, initSchema, loadSnapshot, restoreBackup, makeBackup, saveCollection,
  saveReview, SAMPLES, type CapacitorSqliteConnection,
} from "../src";

async function fakeConnection() {
  const SQL = await initSqlJs();
  const db = new SQL.Database();
  const calls: string[] = [];
  const tx = <T>(on: boolean | undefined, fn: () => T): T => {
    if (!on) return fn();
    db.run("BEGIN");
    try {
      const r = fn();
      db.run("COMMIT");
      return r;
    } catch (e) {
      db.run("ROLLBACK");
      throw e;
    }
  };
  const conn: CapacitorSqliteConnection = {
    async run(statement, values = [], transaction = true) {
      calls.push("run");
      return tx(transaction, () => db.run(statement, values as never));
    },
    async query(statement, values = []) {
      calls.push("query");
      const res = db.exec(statement, values as never)[0];
      return { values: res ? res.values.map((row) => Object.fromEntries(res.columns.map((c, i) => [c, row[i]]))) : [] };
    },
    async execute(statements, transaction = true) {
      calls.push("execute");
      if (/^\s*PRAGMA/i.test(statements) && transaction) throw new Error("PRAGMA inside transaction");
      return tx(transaction, () => db.exec(statements));
    },
    async executeSet(set, transaction = true) {
      calls.push(`executeSet(${set.length})`);
      return tx(transaction, () => set.forEach((s) => db.run(s.statement, (s.values ?? []) as never)));
    },
  };
  return { conn, calls };
}

describe("Capacitor SQLite driver", () => {
  it("stores and loads through the plugin API with batched transactions", async () => {
    const { conn, calls } = await fakeConnection();
    const db = capacitorSqliteDriver(conn);
    await initSchema(db);
    const created = createCollection({ title: "Psalm 23", verses: SAMPLES[1]!.verses });
    calls.length = 0;
    await saveCollection(db, created);
    expect(calls).toEqual([`executeSet(${1 + created.segments.length + created.cards.length})`]); // one bridge call
    const snap = await loadSnapshot(db);
    expect(snap.cards).toHaveLength(created.cards.length);
    const res = applyReview(snap, snap.cards[0]!.id, "good");
    await saveReview(db, res.review, res.changedCards);
    expect((await loadSnapshot(db)).reviews).toHaveLength(1);
  });

  it("is all-or-nothing when a batch fails", async () => {
    const { conn } = await fakeConnection();
    const db = capacitorSqliteDriver(conn);
    await initSchema(db);
    const created = createCollection({ title: "Joh 3,16", verses: SAMPLES[0]!.verses });
    await saveCollection(db, created);
    await expect(saveCollection(db, created)).rejects.toThrow();
    expect((await loadSnapshot(db)).segments).toHaveLength(created.segments.length);
  });

  it("restores a backup (WebView → native migration path)", async () => {
    const { conn } = await fakeConnection();
    const db = capacitorSqliteDriver(conn);
    await initSchema(db);
    const created = createCollection({ title: "Joh 3,16", verses: SAMPLES[0]!.verses });
    const snapshot = { collections: [created.collection], segments: created.segments, cards: created.cards, reviews: [] };
    await restoreBackup(db, makeBackup(snapshot, { ...(await import("../src")).DEFAULT_SETTINGS, newSegmentsPerDay: 2 }));
    expect((await loadSnapshot(db)).segments).toHaveLength(created.segments.length);
  });
});
