// Parsing and formatting of references like "Joh 3,16", "Röm 8,28-39",
// "Ps 23", "Mt 5-7", "John 3:16-18", "1 Cor 13:4–7", "Judas 24-25".

import { BOOK_BY_USFM, findBook } from "./books";

export interface Reference {
  book: string; // USFM id
  startChapter: number;
  /** null = from the start of the chapter */
  startVerse: number | null;
  endChapter: number;
  /** null = to the end of the chapter */
  endVerse: number | null;
}

export type ReferenceError = "empty" | "book" | "format";

const SINGLE_CHAPTER = new Set(["OBA", "PHM", "2JN", "3JN", "JUD"]);

export function parseReference(input: string): Reference | ReferenceError {
  const s = input.trim().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  if (!s) return "empty";
  const m = s.match(/^((?:[1-3]\.?\s*)?[^\d]+?)\s*(\d+)(.*)$/u);
  if (!m) {
    // "Joh drei": a known book followed by something that is not a number
    const words = s.split(" ");
    for (let i = words.length; i > 0; i--) if (findBook(words.slice(0, i).join(" "))) return "format";
    return "book";
  }
  const book = findBook(m[1]!);
  if (!book) return "book";
  const first = Number(m[2]);
  const rest = (m[3] ?? "").trim();
  const r = rest.match(/^(?:[,:.]\s*(\d+))?\s*(?:(?:-|bis|to)\s*(\d+)(?:\s*[,:.]\s*(\d+))?)?\s*(ff?\.?)?$/i);
  if (!r) return "format";
  const [, v1, a, b, suffix] = r;

  if (SINGLE_CHAPTER.has(book.usfm) && v1 === undefined && b === undefined) {
    // "Judas 24-25": numbers are verses
    const start = first;
    const end = a !== undefined ? Number(a) : suffix ? start + (suffix.startsWith("ff") ? 2 : 1) : start;
    return { book: book.usfm, startChapter: 1, startVerse: start, endChapter: 1, endVerse: end };
  }
  if (v1 === undefined) {
    // "Ps 23" or "Mt 5-7"
    const end = a !== undefined ? Number(a) : first;
    return { book: book.usfm, startChapter: first, startVerse: null, endChapter: end, endVerse: null };
  }
  const startVerse = Number(v1);
  if (b !== undefined) return { book: book.usfm, startChapter: first, startVerse, endChapter: Number(a), endVerse: Number(b) };
  let endVerse = a !== undefined ? Number(a) : startVerse;
  if (suffix && a === undefined) endVerse = startVerse + (suffix.toLowerCase().startsWith("ff") ? 2 : 1);
  return { book: book.usfm, startChapter: first, startVerse, endChapter: first, endVerse };
}

export function isReference(r: Reference | ReferenceError): r is Reference {
  return typeof r === "object";
}

/** "Römer 8,28–39" (de) / "Romans 8:28–39" (en). */
export function formatReference(ref: Reference, lang: "de" | "en"): string {
  const info = BOOK_BY_USFM.get(ref.book);
  const name = info ? info[lang] : ref.book;
  const sep = lang === "de" ? "," : ":";
  if (SINGLE_CHAPTER.has(ref.book) && ref.startVerse !== null) {
    return ref.endVerse !== null && ref.endVerse !== ref.startVerse ? `${name} ${ref.startVerse}–${ref.endVerse}` : `${name} ${ref.startVerse}`;
  }
  if (ref.startVerse === null) {
    return ref.endChapter !== ref.startChapter ? `${name} ${ref.startChapter}–${ref.endChapter}` : `${name} ${ref.startChapter}`;
  }
  const start = `${ref.startChapter}${sep}${ref.startVerse}`;
  if (ref.endChapter !== ref.startChapter) return `${name} ${start}–${ref.endChapter}${sep}${ref.endVerse ?? ""}`;
  if (ref.endVerse !== null && ref.endVerse !== ref.startVerse) return `${name} ${start}–${ref.endVerse}`;
  return `${name} ${start}`;
}
