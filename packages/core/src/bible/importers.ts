// Converters from the source formats (OSIS, USFX, scrollmapper JSON) into
// plain verse text per book/chapter. Regex-based on purpose: the sources are
// trusted, well-formed files and this keeps the tool dependency-free.

import { BOOK_BY_OSIS, BOOK_BY_USFM, BOOKS, findBook } from "./books";

/** usfm → chapters[c-1][v-1] */
export type BibleText = Map<string, string[][]>;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

export function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
      e[0] === "#" ? String.fromCodePoint(e[1]!.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : (ENTITIES[e] ?? m),
    )
    .replace(/[¶​]/g, "")
    .replace(/\(H\d+:\d+\)/g, "") // Elberfelder: notes on the Hebrew verse numbering
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?’”»)])/g, "$1")
    .replace(/([(„“«‘])\s+/g, "$1")
    .trim();
}

function put(text: BibleText, usfm: string, chapter: number, verse: number, value: string) {
  if (!value) return;
  let chapters = text.get(usfm);
  if (!chapters) text.set(usfm, (chapters = []));
  while (chapters.length < chapter) chapters.push([]);
  const ch = chapters[chapter - 1]!;
  while (ch.length < verse) ch.push("");
  ch[verse - 1] = ch[verse - 1] ? `${ch[verse - 1]} ${value}` : value;
}

/** Removes elements whose content is not Bible text (notes, headings, cross references). */
function dropNonText(xml: string, tags: string[]): string {
  let out = xml;
  for (const tag of tags) out = out.replace(new RegExp(`<${tag}\\b[^>]*?(?:/>|>[\\s\\S]*?</${tag}>)`, "g"), " ");
  return out;
}

/** OSIS with container verses (<verse osisID>…</verse>) or milestones (sID/eID). */
export function parseOsis(xml: string): BibleText {
  const text: BibleText = new Map();
  const src = dropNonText(xml, ["note", "title", "header"]);
  const re = /<verse\b([^>]*?)(\/?)>|<\/verse>/g;
  let current: string | null = null;
  let start = 0;
  const flush = (end: number) => {
    if (!current) return;
    const [osisBook, c, v] = current.split(".");
    const book = BOOK_BY_OSIS.get(osisBook ?? "");
    if (book && c && v) put(text, book.usfm, Number(c), Number(v), cleanText(src.slice(start, end)));
    current = null;
  };
  for (let m = re.exec(src); m; m = re.exec(src)) {
    const attrs = m[1] ?? "";
    if (m[0] === "</verse>") {
      flush(m.index);
      continue;
    }
    const id = attrs.match(/osisID=['"]([^'" ]+)/)?.[1];
    if (/\beID=/.test(attrs)) {
      flush(m.index);
    } else if (id) {
      flush(m.index);
      current = id;
      start = m.index + m[0].length;
    }
  }
  return text;
}

/** USFX: <book id>, <c id/>, <v id/> … <ve/>. */
export function parseUsfx(xml: string): BibleText {
  const text: BibleText = new Map();
  const src = dropNonText(xml, ["f", "x", "fe", "rem", "s", "d", "h", "toc", "id", "ide", "fig"]);
  const re = /<book\s+id="([^"]+)"|<c\s+id="(\d+)"[^>]*\/>|<v\s+id="(\d+)[^"]*"[^>]*\/>|<ve\s*\/>|<\/book>|<p\b[^>]*>|<\/p>/g;
  let book: string | null = null;
  let chapter = 0;
  let verse = 0;
  let start = -1;
  const flush = (end: number) => {
    if (book && chapter && verse && start >= 0) put(text, book, chapter, verse, cleanText(src.slice(start, end)));
    start = -1;
  };
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[1]) {
      flush(m.index);
      book = BOOK_BY_USFM.has(m[1]) ? m[1] : null;
      chapter = 0;
      verse = 0;
    } else if (m[2]) {
      flush(m.index);
      chapter = Number(m[2]);
      verse = 0;
    } else if (m[3]) {
      flush(m.index);
      verse = Number(m[3]);
      start = m.index + m[0].length;
    } else if (m[0].startsWith("<ve") || m[0] === "</book>") {
      flush(m.index);
    }
    // <p> / </p> inside a verse are just paragraph breaks: keep collecting
  }
  return text;
}

interface ScrollmapperJson {
  books: { name: string; chapters: { chapter: number; verses: { verse: number; text: string }[] }[] }[];
}

/** scrollmapper/bible_databases JSON (formats/json/<id>.json). */
export function parseScrollmapper(json: string): BibleText {
  const data = JSON.parse(json) as ScrollmapperJson;
  const text: BibleText = new Map();
  data.books.forEach((b, i) => {
    const name = b.name.replace(/^III\b/, "3").replace(/^II\b/, "2").replace(/^I\b/, "1").replace(/ of John$/, "");
    // the 66 books come in canonical order; the name check guards against surprises
    const book = findBook(name) ?? (data.books.length === 66 ? BOOKS[i] : undefined);
    if (!book) throw new Error(`unknown book name: ${b.name}`);
    for (const ch of b.chapters) for (const v of ch.verses) put(text, book.usfm, ch.chapter, v.verse, cleanText(v.text));
  });
  return text;
}

export function verseCount(text: BibleText): number {
  let n = 0;
  for (const chapters of text.values()) for (const ch of chapters) n += ch.filter(Boolean).length;
  return n;
}
