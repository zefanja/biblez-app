import { describe, expect, it } from "vitest";
import { extractPassage, findBook, formatReference, parseReference, validateReference, type BibleBook, type BibleIndex, type Reference } from "../src";
import { cleanText, parseOsis, parseScrollmapper, parseUsfx } from "../src/bible/importers";

const ref = (s: string) => parseReference(s) as Reference;

describe("book names", () => {
  it.each([
    ["Joh", "JHN"], ["Johannes", "JHN"], ["John", "JHN"], ["Jn", "JHN"], ["1Joh", "1JN"], ["1. Johannes", "1JN"], ["1 John", "1JN"],
    ["Röm", "ROM"], ["Roemer", null], ["Romans", "ROM"], ["Ps", "PSA"], ["Psalmen", "PSA"], ["1Mo", "GEN"], ["1. Mose", "GEN"],
    ["Gen", "GEN"], ["Offb", "REV"], ["Rev", "REV"], ["Offenbarung", "REV"], ["Phil", "PHP"], ["Phlm", "PHM"], ["Philip", "PHP"],
    ["Hes", "EZK"], ["Ezek", "EZK"], ["Spr", "PRO"], ["Prov", "PRO"], ["1Kön", "1KI"], ["1 Kings", "1KI"], ["Hebr", "HEB"],
    ["Pred", "ECC"], ["Song of Songs", "SNG"], ["Jak", "JAS"], ["James", "JAS"], ["Xyz", null],
  ])("%s → %s", (input, usfm) => {
    expect(findBook(input)?.usfm ?? null).toBe(usfm);
  });
});

describe("parseReference", () => {
  it("parses German and English notations", () => {
    expect(ref("Joh 3,16")).toEqual({ book: "JHN", startChapter: 3, startVerse: 16, endChapter: 3, endVerse: 16 });
    expect(ref("John 3:16-18")).toEqual({ book: "JHN", startChapter: 3, startVerse: 16, endChapter: 3, endVerse: 18 });
    expect(ref("Röm 8,28–39")).toEqual({ book: "ROM", startChapter: 8, startVerse: 28, endChapter: 8, endVerse: 39 });
    expect(ref("Ps 23")).toEqual({ book: "PSA", startChapter: 23, startVerse: null, endChapter: 23, endVerse: null });
    expect(ref("Mt 5-7")).toEqual({ book: "MAT", startChapter: 5, startVerse: null, endChapter: 7, endVerse: null });
    expect(ref("Mt 5,1-6,4")).toEqual({ book: "MAT", startChapter: 5, startVerse: 1, endChapter: 6, endVerse: 4 });
    expect(ref("1. Kor 13,4-7").book).toBe("1CO");
    expect(ref("1 Cor 13:4–7").endVerse).toBe(7);
    expect(ref("Phil 4,6f")).toMatchObject({ startVerse: 6, endVerse: 7 });
    expect(ref("Judas 24-25")).toEqual({ book: "JUD", startChapter: 1, startVerse: 24, endChapter: 1, endVerse: 25 });
  });
  it("reports errors", () => {
    expect(parseReference("")).toBe("empty");
    expect(parseReference("Xyz 3,16")).toBe("book");
    expect(parseReference("Joh drei")).toBe("format");
    expect(parseReference("Joh 3,16 und so")).toBe("format");
  });
  it("formats per language", () => {
    expect(formatReference(ref("rom 8,28-39"), "de")).toBe("Römer 8,28–39");
    expect(formatReference(ref("rom 8,28-39"), "en")).toBe("Romans 8:28–39");
    expect(formatReference(ref("ps 23"), "de")).toBe("Psalm 23");
    expect(formatReference(ref("mt 5-7"), "de")).toBe("Matthäus 5–7");
    expect(formatReference(ref("Mt 5,1-6,4"), "en")).toBe("Matthew 5:1–6:4");
    expect(formatReference(ref("1joh 1,9"), "de")).toBe("1. Johannes 1,9");
    expect(formatReference(ref("jude 24-25"), "en")).toBe("Jude 24–25");
  });
});

describe("passages", () => {
  const book: BibleBook = { book: "JHN", chapters: [["a1", "a2"], ["b1", "b2", "b3"], ["c1"]] };
  const index = { id: "t", name: "T", abbreviation: "T", language: "de", year: 1, license: "PD", source: "", books: [{ id: "JHN", verses: [2, 3, 1] }] } as BibleIndex;
  it("extracts verses, numbering chapters when crossing them", () => {
    expect(extractPassage(book, ref("Joh 2,2-3"), "de")).toEqual([{ number: "2", text: "b2" }, { number: "3", text: "b3" }]);
    expect(extractPassage(book, ref("Joh 2"), "de").map((v) => v.text)).toEqual(["b1", "b2", "b3"]);
    expect(extractPassage(book, ref("Joh 1,2-2,1"), "de").map((v) => v.number)).toEqual(["1,2", "2,1"]);
    expect(extractPassage(book, ref("John 1:2-2:1"), "en").map((v) => v.number)).toEqual(["1:2", "2:1"]);
  });
  it("validates against the translation's verse counts", () => {
    expect(validateReference(index, ref("Joh 2,3"))).toBeNull();
    expect(validateReference(index, ref("Joh 4"))).toBe("chapter");
    expect(validateReference(index, ref("Joh 2,4"))).toBe("verse");
    expect(validateReference(index, ref("Joh 2,3-1"))).toBe("verse");
    expect(validateReference(index, ref("Röm 1,1"))).toBe("missing_book");
  });
});

describe("importers", () => {
  it("cleans markup and entities", () => {
    expect(cleanText('<w s="G1">God</w> <f>note</f>so &amp; <add>loved</add> , the ¶ world')).toBe("God note so & loved, the world");
    expect(cleanText("(H5:20) Und Jehova redete")).toBe("Und Jehova redete");
  });
  it("reads OSIS with container verses and milestones", () => {
    const container = `<div type='book' osisID='John'><chapter osisID='John.3'><verse osisID='John.3.16'>Also hat Gott</verse><verse osisID='John.3.17'>Denn</verse></chapter></div>`;
    expect(parseOsis(container).get("JHN")?.[2]?.slice(15)).toEqual(["Also hat Gott", "Denn"]);
    const milestone = `<chapter osisID="Ps.23"><title type="psalm">A Psalm of David.</title><verse osisID="Ps.23.1" sID="x1"/><w>The</w> LORD <note>n</note>is my shepherd;<verse eID="x1"/></chapter>`;
    expect(parseOsis(milestone).get("PSA")?.[22]?.[0]).toBe("The LORD is my shepherd;");
  });
  it("reads USFX and skips footnotes and headings", () => {
    const usfx = `<book id="JHN"><c id="3"/><s>Heading</s><p><v id="16"/><wj>For God so loved</wj><f caller="+">fn</f> the world.<ve/></p><v id="17"/>For God<ve/></book>`;
    const text = parseUsfx(usfx).get("JHN")?.[2];
    expect(text?.[15]).toBe("For God so loved the world.");
    expect(text?.[16]).toBe("For God");
  });
  it("reads scrollmapper JSON", () => {
    const json = JSON.stringify({ books: [{ name: "I John", chapters: [{ chapter: 1, verses: [{ verse: 9, text: "Wenn wir" }] }] }] });
    expect(parseScrollmapper(json).get("1JN")?.[0]?.[8]).toBe("Wenn wir");
  });
});

// Runs against the generated files (pnpm bibles); skipped when they are absent.
import { existsSync, readFileSync } from "node:fs";
import { POPULAR_REFERENCES } from "../src";
const dataDir = new URL("../../../apps/client/public/bibles/", import.meta.url);
describe.skipIf(!existsSync(dataDir))("generated Bible data", () => {
  const list = JSON.parse(readFileSync(new URL("translations.json", dataDir), "utf8")) as { id: string; language: "de" | "en" }[];
  it("contains the six free translations", () => {
    expect(list.map((t) => t.id).sort()).toEqual(["bsb", "elb1905", "kjv", "lut1912", "sch1951", "web"]);
  });
  it.each(list.map((t) => [t.id, t.language] as const))("%s resolves every suggested reference", (id, lang) => {
    const index = JSON.parse(readFileSync(new URL(`${id}/index.json`, dataDir), "utf8")) as BibleIndex;
    for (const p of POPULAR_REFERENCES) {
      const r = ref(p[lang]);
      expect(validateReference(index, r), `${id} ${p[lang]}`).toBeNull();
      const book = JSON.parse(readFileSync(new URL(`${id}/${r.book}.json`, dataDir), "utf8")) as BibleBook;
      const verses = extractPassage(book, r, lang);
      expect(verses.length, `${id} ${p[lang]}`).toBeGreaterThan(0);
      for (const v of verses) expect(v.text, `${id} ${p[lang]} ${v.number}`).not.toMatch(/[<>]|\(H\d/);
    }
  });
});
