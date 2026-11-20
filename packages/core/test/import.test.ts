import { readFileSync } from "node:fs";
import initSqlJs from "sql.js";
import { describe, expect, it } from "vitest";
import {
  AnkiImportError, exportApkg, importAnkiPackage, initSchema, loadSnapshot, saveImport, sqlJsDriver, buildQueue,
  type AnkiImportResult,
} from "../src";

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`./fixtures/${name}`, import.meta.url)));
interface ExpectedCard { id: number; ord: number; revlog: { id: number; ease: number; type: number }[] }
interface ExpectedNote { id: number; guid: string; fields: Record<string, string>; cards: ExpectedCard[] }
const expected = JSON.parse(readFileSync(new URL("./fixtures/anki-expected.json", import.meta.url), "utf8")) as {
  notes: ExpectedNote[]; otherNotes: number; resetCard: number;
};

/** Reviews BibleZ should take over: stage cards only, history after a reset. */
function expectedReviews(card: ExpectedCard): number {
  if (card.ord === 2) return 0;
  const lastReset = card.revlog.map((r) => r.ease === 0 && r.type === 4).lastIndexOf(true);
  return card.revlog.slice(lastReset + 1).filter((r) => r.ease > 0).length;
}

describe("Anki import (real exports of add-on cards, Anki 26.09)", async () => {
  const SQL = await initSqlJs();
  const now = Date.now();
  const results: Record<string, AnkiImportResult> = {
    legacy: importAnkiPackage(SQL, fixture("anki-legacy.apkg"), { now }),
    modern: importAnkiPackage(SQL, fixture("anki-modern.apkg"), { now }),
  };

  it.each(["legacy", "modern"])("%s: finds both passages and ignores other notes and table cards", (kind) => {
    const { report, created } = results[kind]!;
    expect(report.format).toBe(kind === "legacy" ? "anki21" : "anki21b");
    expect(created.map((c) => c.collection.title)).toEqual(["Johannes 3,16", "Psalm 23 & mehr"]);
    expect(report.segments).toBe(expected.notes.length);
    expect(report.ignoredNotes).toBe(expected.otherNotes);
    expect(report.ignoredTableCards).toBe(expected.notes.flatMap((n) => n.cards).filter((c) => c.ord === 2).length);
  });

  it.each(["legacy", "modern"])("%s: keeps text, order, Anki note ids, GUIDs and card ids", (kind) => {
    const segments = results[kind]!.created.flatMap((c) => c.segments);
    const cards = results[kind]!.created.flatMap((c) => c.cards);
    expect(segments.map((s) => s.ankiGuid)).toEqual(expected.notes.map((n) => n.guid));
    expect(segments.map((s) => s.ankiNoteId)).toEqual(expected.notes.map((n) => n.id));
    expect(segments[0]).toMatchObject({ verseNumber: "16", part: "a", text: "Also hat Gott die Welt geliebt, daß er seinen eingebornen Sohn gab," });
    expect(segments[1]).toMatchObject({ verseNumber: "16", part: "b" });
    expect(segments.find((s) => s.verseNumber === "4" && s.part === "b")?.text).toBe("denn du bist bei mir, dein Stecken und Stab trösten mich.");
    for (const note of expected.notes) {
      const seg = segments.find((s) => s.ankiGuid === note.guid)!;
      for (const c of note.cards.filter((c) => c.ord !== 2)) {
        const stage = ({ 0: 1, 1: 2, 3: 3 } as const)[c.ord as 0 | 1 | 3];
        expect(cards.find((k) => k.segmentId === seg.id && k.stage === stage)?.ankiCardId).toBe(c.id);
      }
    }
  });

  it.each(["legacy", "modern"])("%s: takes over the learning history (reset discards older reviews)", (kind) => {
    const { reviews, created } = results[kind]!;
    const total = expected.notes.flatMap((n) => n.cards).reduce((sum, c) => sum + expectedReviews(c), 0);
    expect(total).toBeGreaterThan(10);
    expect(reviews).toHaveLength(total);
    const resetCard = created.flatMap((c) => c.cards).find((k) => k.ankiCardId === expected.resetCard);
    if (resetCard) expect(reviews.filter((r) => r.cardId === resetCard.id)).toHaveLength(0);
    expect(reviews.some((r) => r.rating === "again")).toBe(true);
  });

  it("keeps exactly one active stage per segment (the highest one studied)", () => {
    const { created, reviews } = results.modern!;
    for (const col of created) {
      for (const seg of col.segments) {
        const cards = col.cards.filter((k) => k.segmentId === seg.id);
        const active = cards.filter((k) => k.unlockedAt !== null && k.retiredAt === null);
        expect(active).toHaveLength(1);
        const studied = cards.filter((k) => reviews.some((r) => r.cardId === k.id)).map((k) => k.stage);
        expect(active[0]!.stage).toBe(studied.length ? Math.max(...studied) : 1);
      }
    }
  });

  it("legacy and modern exports give the same result", () => {
    const shape = (r: AnkiImportResult) => r.created.map((c) => ({
      title: c.collection.title,
      segs: c.segments.map((s) => [s.ankiGuid, s.text, s.verseNumber, s.part]),
      cards: c.cards.map((k) => [k.ankiCardId, k.stage, k.unlockedAt !== null, k.retiredAt !== null]),
    }));
    expect(shape(results.legacy!)).toEqual(shape(results.modern!));
    expect(results.legacy!.reviews.map((r) => [r.reviewedAt, r.rating])).toEqual(results.modern!.reviews.map((r) => [r.reviewedAt, r.rating]));
  });

  it("stores the import and can study it right away", async () => {
    const db = sqlJsDriver(new SQL.Database());
    await initSchema(db);
    await saveImport(db, results.modern!.created, results.modern!.reviews);
    const snap = await loadSnapshot(db);
    expect(snap.segments).toHaveLength(expected.notes.length);
    expect(snap.reviews).toHaveLength(results.modern!.reviews.length);
    expect(buildQueue(snap, now).now.length).toBeGreaterThan(0);
  });

  it("does not duplicate on a second import", () => {
    const guids = new Set(results.modern!.created.flatMap((c) => c.segments.map((s) => s.ankiGuid)));
    expect(() => importAnkiPackage(SQL, fixture("anki-modern.apkg"), { existingGuids: guids })).toThrow(AnkiImportError);
  });

  it("round-trips BibleZ → Anki package → BibleZ with the same ids and history", async () => {
    const db = sqlJsDriver(new SQL.Database());
    await initSchema(db);
    await saveImport(db, results.modern!.created, results.modern!.reviews);
    const snap = await loadSnapshot(db);
    const again = importAnkiPackage(SQL, exportApkg(SQL, snap, { now }).bytes, { now });
    expect(again.created.flatMap((c) => c.segments.map((s) => s.ankiGuid))).toEqual(snap.segments.map((s) => s.ankiGuid));
    const byTime = (rs: { reviewedAt: number; rating: string }[]) => rs.map((r) => [r.reviewedAt, r.rating]).sort((a, b) => Number(a[0]) - Number(b[0]));
    expect(byTime(again.reviews)).toEqual(byTime(snap.reviews));
    expect(again.created.flatMap((c) => c.cards.map((k) => k.ankiCardId)).sort()).toEqual(snap.cards.map((k) => k.ankiCardId).sort());
  });

  it("rejects files that are not Anki packages", () => {
    expect(() => importAnkiPackage(SQL, new Uint8Array([1, 2, 3]))).toThrow("not_anki");
  });
});
