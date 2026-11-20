import { describe, expect, it } from "vitest";
import { chunkVerse, firstLetters, maskLastLetters, parseVerses, SAMPLES, wordCount } from "../src";

describe("hint stages", () => {
  it("masks the last letter like the Anki add-on", () => {
    expect(maskLastLetters("Also hat Gott die Welt geliebt,")).toBe("Als_ ha_ Got_ di_ Wel_ gelieb_,");
  });
  it("keeps first letters, Unicode-aware", () => {
    expect(firstLetters("Öl und Überfluss; Äpfel")).toBe("Ö u Ü; Ä");
  });
  it("counts words", () => {
    expect(wordCount("auf daß alle, die an ihn glauben,")).toBe(7);
  });
});

describe("chunkVerse", () => {
  it("splits John 3:16 (Luther 1912) into five short chunks", () => {
    expect(chunkVerse(SAMPLES[0]!.verses[0]!.text)).toEqual([
      "Also hat Gott die Welt geliebt,",
      "daß er seinen eingebornen Sohn gab,",
      "auf daß alle, die an ihn glauben,",
      "nicht verloren werden,",
      "sondern das ewige Leben haben.",
    ]);
  });
  it("keeps every chunk short for all samples", () => {
    for (const sample of SAMPLES) {
      for (const verse of sample.verses) {
        const chunks = chunkVerse(verse.text);
        expect(chunks.join(" ")).toBe(verse.text);
        for (const c of chunks) expect(wordCount(c)).toBeLessThanOrEqual(9);
      }
    }
  });
  it("splits long clauses before a conjunction or preposition", () => {
    expect(chunkVerse("Er erquicket meine Seele; er führet mich auf rechter Straße um seines Namens willen.")).toEqual([
      "Er erquicket meine Seele;",
      "er führet mich auf rechter Straße",
      "um seines Namens willen.",
    ]);
    expect(chunkVerse("Er weidet mich auf einer grünen Aue und führet mich zum frischen Wasser.")).toEqual([
      "Er weidet mich auf einer grünen Aue",
      "und führet mich zum frischen Wasser.",
    ]);
  });
  it("splits long clauses without punctuation", () => {
    const chunks = chunkVerse("eins zwei drei vier fünf sechs sieben acht neun zehn elf zwölf dreizehn vierzehn");
    expect(chunks.length).toBe(2);
  });
  it("merges a tiny trailing clause", () => {
    expect(chunkVerse("Der Herr segne dich und behüte dich. Amen.")).toEqual(["Der Herr segne dich und behüte dich. Amen."]);
  });
});

describe("parseVerses", () => {
  it("detects inline and superscript verse numbers", () => {
    expect(parseVerses("1 Im Anfang war das Wort. 2 Dasselbe war im Anfang bei Gott.")).toEqual([
      { number: "1", text: "Im Anfang war das Wort." },
      { number: "2", text: "Dasselbe war im Anfang bei Gott." },
    ]);
    expect(parseVerses("¹Im Anfang war das Wort. ²Dasselbe").map((v) => v.number)).toEqual(["1", "2"]);
  });
  it("treats text without numbers as one verse", () => {
    expect(parseVerses("Seid allezeit fröhlich")).toEqual([{ number: "1", text: "Seid allezeit fröhlich" }]);
  });
});
