// Bible text data: format of the generated files and passage extraction.
//
//   bibles/translations.json          → TranslationInfo[]
//   bibles/<id>/index.json            → BibleIndex (verse counts per chapter)
//   bibles/<id>/<USFM>.json           → BibleBook (chapters[c-1][v-1] = text)

import type { Verse } from "../text/parse";
import type { Reference } from "./reference";

export interface TranslationInfo {
  id: string;
  name: string;
  abbreviation: string;
  language: "de" | "en";
  year: number;
  /** "Public Domain" or the licence text that must be shown. */
  license: string;
  licenseNote?: string;
  source: string;
}

export interface BibleIndex extends TranslationInfo {
  books: { id: string; verses: number[] }[];
}

export interface BibleBook {
  book: string;
  /** chapters[c-1][v-1]; "" where a verse does not exist in this translation */
  chapters: string[][];
}

export type PassageError = "chapter" | "verse" | "missing_book" | "too_long";

export const MAX_PASSAGE_VERSES = 60;

/** Checks a reference against a translation's index (chapter/verse ranges). */
export function validateReference(index: BibleIndex, ref: Reference): PassageError | null {
  const book = index.books.find((b) => b.id === ref.book);
  if (!book) return "missing_book";
  const chapters = book.verses.length;
  if (ref.startChapter < 1 || ref.endChapter > chapters || ref.endChapter < ref.startChapter) return "chapter";
  const lastOf = (c: number) => book.verses[c - 1] ?? 0;
  if (ref.startVerse !== null && (ref.startVerse < 1 || ref.startVerse > lastOf(ref.startChapter))) return "verse";
  if (ref.endVerse !== null && (ref.endVerse > lastOf(ref.endChapter) || (ref.endChapter === ref.startChapter && ref.endVerse < (ref.startVerse ?? 1)))) return "verse";
  let count = 0;
  for (let c = ref.startChapter; c <= ref.endChapter; c++) {
    const from = c === ref.startChapter ? (ref.startVerse ?? 1) : 1;
    const to = c === ref.endChapter ? (ref.endVerse ?? lastOf(c)) : lastOf(c);
    count += Math.max(0, to - from + 1);
  }
  return count > MAX_PASSAGE_VERSES ? "too_long" : null;
}

/** Verses of a passage. Across chapters the number becomes "6,1" (de) / "6:1" (en). */
export function extractPassage(book: BibleBook, ref: Reference, lang: "de" | "en"): Verse[] {
  const verses: Verse[] = [];
  const multiChapter = ref.endChapter !== ref.startChapter;
  for (let c = ref.startChapter; c <= ref.endChapter; c++) {
    const chapter = book.chapters[c - 1] ?? [];
    const from = c === ref.startChapter ? (ref.startVerse ?? 1) : 1;
    const to = c === ref.endChapter ? (ref.endVerse ?? chapter.length) : chapter.length;
    for (let v = from; v <= to; v++) {
      const text = chapter[v - 1]?.trim();
      if (!text) continue;
      verses.push({ number: multiChapter ? `${c}${lang === "de" ? "," : ":"}${v}` : String(v), text });
    }
  }
  return verses;
}
