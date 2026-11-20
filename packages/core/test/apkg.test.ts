import initSqlJs from "sql.js";
import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";
import { exportApkg, NOTETYPE_ID, noteFields, createCollection, SAMPLES, segmentsOf, emptySnapshot } from "../src";
import { simulate } from "../scripts/export-sample";

describe("Anki export", async () => {
  const SQL = await initSqlJs();
  const now = new Date(2026, 10, 20, 12).getTime();
  const snap = simulate(now, 20);
  const { bytes, noteCount, cardCount, reviewCount } = exportApkg(SQL, snap, { now });
  const files = unzipSync(bytes);
  const db = new SQL.Database(files["collection.anki2"]);
  const one = (sql: string) => db.exec(sql)[0]!.values;

  it("packs collection and empty media map", () => {
    expect(Object.keys(files).sort()).toEqual(["collection.anki2", "media"]);
    expect(strFromU8(files.media!)).toBe("{}");
  });

  it("exports every segment, card and review", () => {
    expect(noteCount).toBe(snap.segments.length);
    expect(cardCount).toBe(snap.cards.length);
    expect(reviewCount).toBe(snap.reviews.length);
    expect(one("select count() from revlog")[0]![0]).toBe(snap.reviews.length);
    expect(one(`select count() from notes where mid = ${NOTETYPE_ID}`)[0]![0]).toBe(snap.segments.length);
  });

  it("writes revlog ids in chronological order matching review times", () => {
    const ids = one("select id from revlog order by id").map((r) => r[0] as number);
    const times = snap.reviews.map((r) => r.reviewedAt).sort((a, b) => a - b);
    ids.forEach((id, i) => expect(Math.abs(id - times[i]!)).toBeLessThan(50));
  });

  it("suspends resting stages and maps stages to Card 1/2/4", () => {
    const retired = snap.cards.filter((c) => c.retiredAt !== null).length;
    expect(one("select count() from cards where queue = -1")[0]![0]).toBe(retired);
    expect(one("select distinct ord from cards order by ord").map((r) => r[0])).toEqual([0, 1, 3]);
  });

  it("builds add-on compatible fields", () => {
    const s = emptySnapshot();
    const c = createCollection({ title: "Johannes 3,16", verses: SAMPLES[0]!.verses }, now);
    s.collections.push(c.collection); s.segments.push(...c.segments); s.cards.push(...c.cards);
    const segs = segmentsOf(s, c.collection.id);
    const f0 = noteFields(c.collection, segs, 0);
    expect(f0.answer).toBe("16 Also hat Gott die Welt geliebt,");
    expect(f0.front).toBe("[Beginning]");
    expect(f0.table).toBe("");
    const f2 = noteFields(c.collection, segs, 2);
    expect(f2.front).toBe("16 Also hat Gott die Welt geliebt,<br>daß er seinen eingebornen Sohn gab,<br>");
    expect(f2.last_letters).toBe("au_ da_ all_, di_ a_ ih_ glaube_,");
    expect(f2.first_letters).toBe("a d a, d a i g,");
  });
});
