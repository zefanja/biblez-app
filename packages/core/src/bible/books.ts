// The 66 books of the Protestant canon with USFM/OSIS ids and German/English
// names and abbreviations (German: Loccumer Richtlinien; English: SBL style).

export interface BookInfo {
  usfm: string;
  osis: string;
  de: string;
  en: string;
  /** Extra spellings/abbreviations accepted when parsing (any language). */
  aliases: string[];
}

const B = (usfm: string, osis: string, de: string, en: string, ...aliases: string[]): BookInfo => ({ usfm, osis, de, en, aliases });

export const BOOKS: BookInfo[] = [
  B("GEN", "Gen", "1. Mose", "Genesis", "1Mo", "1Mose", "Gen", "Gn"),
  B("EXO", "Exod", "2. Mose", "Exodus", "2Mo", "2Mose", "Ex", "Exod"),
  B("LEV", "Lev", "3. Mose", "Leviticus", "3Mo", "3Mose", "Lev", "Levitikus", "Lv"),
  B("NUM", "Num", "4. Mose", "Numbers", "4Mo", "4Mose", "Num", "Numeri", "Nm"),
  B("DEU", "Deut", "5. Mose", "Deuteronomy", "5Mo", "5Mose", "Dtn", "Deut", "Dt", "Deuteronomium"),
  B("JOS", "Josh", "Josua", "Joshua", "Jos", "Josh"),
  B("JDG", "Judg", "Richter", "Judges", "Ri", "Judg", "Jdg"),
  B("RUT", "Ruth", "Rut", "Ruth", "Rt", "Ruth"),
  B("1SA", "1Sam", "1. Samuel", "1 Samuel", "1Sam", "1Sm"),
  B("2SA", "2Sam", "2. Samuel", "2 Samuel", "2Sam", "2Sm"),
  B("1KI", "1Kgs", "1. Könige", "1 Kings", "1Kön", "1Kg", "1Kgs", "1Ki"),
  B("2KI", "2Kgs", "2. Könige", "2 Kings", "2Kön", "2Kg", "2Kgs", "2Ki"),
  B("1CH", "1Chr", "1. Chronik", "1 Chronicles", "1Chr", "1Chron"),
  B("2CH", "2Chr", "2. Chronik", "2 Chronicles", "2Chr", "2Chron"),
  B("EZR", "Ezra", "Esra", "Ezra", "Esr", "Ezr"),
  B("NEH", "Neh", "Nehemia", "Nehemiah", "Neh"),
  B("EST", "Esth", "Ester", "Esther", "Est", "Esth"),
  B("JOB", "Job", "Hiob", "Job", "Hi", "Ijob", "Hiob"),
  B("PSA", "Ps", "Psalm", "Psalm", "Ps", "Psa", "Psalmen", "Psalms", "Pss"),
  B("PRO", "Prov", "Sprüche", "Proverbs", "Spr", "Prov", "Prv"),
  B("ECC", "Eccl", "Prediger", "Ecclesiastes", "Pred", "Koh", "Kohelet", "Eccl", "Ecc", "Qoh"),
  B("SNG", "Song", "Hoheslied", "Song of Songs", "Hld", "Hohelied", "Song", "Song of Solomon", "SoS", "Cant"),
  B("ISA", "Isa", "Jesaja", "Isaiah", "Jes", "Isa"),
  B("JER", "Jer", "Jeremia", "Jeremiah", "Jer"),
  B("LAM", "Lam", "Klagelieder", "Lamentations", "Klgl", "Lam"),
  B("EZK", "Ezek", "Hesekiel", "Ezekiel", "Hes", "Ez", "Ezechiel", "Ezek", "Ezk"),
  B("DAN", "Dan", "Daniel", "Daniel", "Dan", "Dn"),
  B("HOS", "Hos", "Hosea", "Hosea", "Hos"),
  B("JOL", "Joel", "Joel", "Joel", "Joel", "Jl"),
  B("AMO", "Amos", "Amos", "Amos", "Am"),
  B("OBA", "Obad", "Obadja", "Obadiah", "Obd", "Obad", "Ob"),
  B("JON", "Jonah", "Jona", "Jonah", "Jon"),
  B("MIC", "Mic", "Micha", "Micah", "Mi", "Mic"),
  B("NAM", "Nah", "Nahum", "Nahum", "Nah"),
  B("HAB", "Hab", "Habakuk", "Habakkuk", "Hab"),
  B("ZEP", "Zeph", "Zefanja", "Zephaniah", "Zef", "Zeph", "Zephanja"),
  B("HAG", "Hag", "Haggai", "Haggai", "Hag"),
  B("ZEC", "Zech", "Sacharja", "Zechariah", "Sach", "Zech", "Zec"),
  B("MAL", "Mal", "Maleachi", "Malachi", "Mal"),
  B("MAT", "Matt", "Matthäus", "Matthew", "Mt", "Matt", "Mat"),
  B("MRK", "Mark", "Markus", "Mark", "Mk", "Mar", "Mrk"),
  B("LUK", "Luke", "Lukas", "Luke", "Lk", "Luk"),
  B("JHN", "John", "Johannes", "John", "Joh", "Jn", "Jhn"),
  B("ACT", "Acts", "Apostelgeschichte", "Acts", "Apg"),
  B("ROM", "Rom", "Römer", "Romans", "Röm", "Rom", "Rm"),
  B("1CO", "1Cor", "1. Korinther", "1 Corinthians", "1Kor", "1Cor", "1Co"),
  B("2CO", "2Cor", "2. Korinther", "2 Corinthians", "2Kor", "2Cor", "2Co"),
  B("GAL", "Gal", "Galater", "Galatians", "Gal"),
  B("EPH", "Eph", "Epheser", "Ephesians", "Eph"),
  B("PHP", "Phil", "Philipper", "Philippians", "Phil", "Php"),
  B("COL", "Col", "Kolosser", "Colossians", "Kol", "Col"),
  B("1TH", "1Thess", "1. Thessalonicher", "1 Thessalonians", "1Thess", "1Thes", "1Th"),
  B("2TH", "2Thess", "2. Thessalonicher", "2 Thessalonians", "2Thess", "2Thes", "2Th"),
  B("1TI", "1Tim", "1. Timotheus", "1 Timothy", "1Tim", "1Ti"),
  B("2TI", "2Tim", "2. Timotheus", "2 Timothy", "2Tim", "2Ti"),
  B("TIT", "Titus", "Titus", "Titus", "Tit"),
  B("PHM", "Phlm", "Philemon", "Philemon", "Phlm", "Phm", "Philem"),
  B("HEB", "Heb", "Hebräer", "Hebrews", "Hebr", "Heb"),
  B("JAS", "Jas", "Jakobus", "James", "Jak", "Jas", "Jk"),
  B("1PE", "1Pet", "1. Petrus", "1 Peter", "1Petr", "1Pet", "1Pt"),
  B("2PE", "2Pet", "2. Petrus", "2 Peter", "2Petr", "2Pet", "2Pt"),
  B("1JN", "1John", "1. Johannes", "1 John", "1Joh", "1Jn", "1Jo"),
  B("2JN", "2John", "2. Johannes", "2 John", "2Joh", "2Jn", "2Jo"),
  B("3JN", "3John", "3. Johannes", "3 John", "3Joh", "3Jn", "3Jo"),
  B("JUD", "Jude", "Judas", "Jude", "Jud", "Jd"),
  B("REV", "Rev", "Offenbarung", "Revelation", "Offb", "Off", "Apk", "Rev", "Rv"),
];

export const BOOK_BY_USFM = new Map(BOOKS.map((b) => [b.usfm, b]));
export const BOOK_BY_OSIS = new Map(BOOKS.map((b) => [b.osis, b]));

/** Lookup key: lower case, no diacritics, no dots/spaces ("1. Könige" → "1konige"). */
export function bookKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[.\s]/g, "");
}

const exact = new Map<string, string>();
for (const b of BOOKS) for (const name of [b.de, b.en, b.osis, b.usfm, ...b.aliases]) exact.set(bookKey(name), b.usfm);

/** Resolves a book name or abbreviation (German or English) to its USFM id. */
export function findBook(input: string): BookInfo | null {
  const key = bookKey(input);
  if (!key) return null;
  const hit = exact.get(key);
  if (hit) return BOOK_BY_USFM.get(hit)!;
  // unambiguous prefix of a full name ("Philip" → Philipper, "Offenb" → Offenbarung)
  if (key.replace(/^\d/, "").length < 3) return null;
  const matches = new Set<string>();
  for (const b of BOOKS) if (bookKey(b.de).startsWith(key) || bookKey(b.en).startsWith(key)) matches.add(b.usfm);
  return matches.size === 1 ? BOOK_BY_USFM.get([...matches][0]!)! : null;
}
