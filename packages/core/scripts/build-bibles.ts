// Downloads the free Bible translations (pinned commits + SHA-256), converts
// them and writes the app's data files:
//
//   apps/client/public/bibles/translations.json
//   apps/client/public/bibles/<id>/index.json
//   apps/client/public/bibles/<id>/<USFM>.json
//
// Usage: pnpm bibles   (downloads are cached in .cache/bibles)

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BOOKS } from "../src/bible/books";
import type { BibleBook, BibleIndex, TranslationInfo } from "../src/bible/data";
import { parseOsis, parseScrollmapper, parseUsfx, verseCount, type BibleText } from "../src/bible/importers";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const cacheDir = join(root, ".cache", "bibles");
const outDir = join(root, "apps", "client", "public", "bibles");

const OPEN_BIBLES = "https://raw.githubusercontent.com/seven1m/open-bibles/8b330654ade69f7c96268c761da18dc83a1f49b7";
const SCROLLMAPPER = "https://raw.githubusercontent.com/scrollmapper/bible_databases/59b18c5af5845728c275d5b7178ad0d024172b1f/formats/json";

interface Source extends TranslationInfo {
  url: string;
  sha256: string;
  parse: (content: string) => BibleText;
}

const SOURCES: Source[] = [
  {
    id: "lut1912", name: "Luther 1912", abbreviation: "LUT1912", language: "de", year: 1912, license: "Public Domain",
    source: "seven1m/open-bibles (deu-luther1912.osis.xml)", url: `${OPEN_BIBLES}/deu-luther1912.osis.xml`,
    sha256: "5df33f4bf3e086b6490b467cf8ddbf4cf95126b2826efaddf17b223ddd07f92b", parse: parseOsis,
  },
  {
    id: "sch1951", name: "Schlachter 1951", abbreviation: "SCH1951", language: "de", year: 1951, license: "Public Domain",
    source: "scrollmapper/bible_databases (GerSch)", url: `${SCROLLMAPPER}/GerSch.json`,
    sha256: "f784c4a5c5842df02aa1ee25d8d6eb2a11c93398b607351f4b5b3c1d7263cc85", parse: parseScrollmapper,
  },
  {
    id: "elb1905", name: "Elberfelder 1905", abbreviation: "ELB1905", language: "de", year: 1905, license: "Public Domain",
    licenseNote: "Unrevidierte Elberfelder Bibel (Darby)",
    source: "scrollmapper/bible_databases (GerElb1905)", url: `${SCROLLMAPPER}/GerElb1905.json`,
    sha256: "c3bc2115750db82fb7c9ab650fcd05e22251d29fbb1c7870db6e81c6a1b54557", parse: parseScrollmapper,
  },
  {
    id: "kjv", name: "King James Version", abbreviation: "KJV", language: "en", year: 1769, license: "Public Domain",
    licenseNote: "Public domain except in the United Kingdom (Crown copyright, Cambridge University Press).",
    source: "seven1m/open-bibles (eng-kjv.osis.xml)", url: `${OPEN_BIBLES}/eng-kjv.osis.xml`,
    sha256: "eeeae647fc28360ce47f9c0d5cc3b397b7fdd9913fe53dc9f44eb6deee50e253", parse: parseOsis,
  },
  {
    id: "bsb", name: "Berean Standard Bible", abbreviation: "BSB", language: "en", year: 2023, license: "Public Domain",
    licenseNote: "Dedicated to the public domain (CC0) by Bible Hub, 2023.",
    source: "seven1m/open-bibles (eng-bsb.usfx.xml)", url: `${OPEN_BIBLES}/eng-bsb.usfx.xml`,
    sha256: "7bf75004ecbc8901f179bd36078cf48fa4eb34cb2894791342ac840bcbf586fb", parse: parseUsfx,
  },
  {
    id: "web", name: "World English Bible", abbreviation: "WEB", language: "en", year: 2020, license: "Public Domain",
    licenseNote: "“World English Bible” is a trademark of eBible.org.",
    source: "seven1m/open-bibles (eng-web.usfx.xml)", url: `${OPEN_BIBLES}/eng-web.usfx.xml`,
    sha256: "5ffa2626f170a109a4a96afc90775c06f0821cb4ba81ed34e63663e085708d68", parse: parseUsfx,
  },
];

async function fetchSource(src: Source): Promise<string> {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, src.url.split("/").pop()!);
  let bytes: Buffer;
  if (existsSync(file)) {
    bytes = readFileSync(file);
  } else {
    process.stdout.write(`  downloading ${src.url} … `);
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`${src.url}: HTTP ${res.status}`);
    bytes = Buffer.from(await res.arrayBuffer());
    console.log(`${(bytes.length / 1e6).toFixed(1)} MB`);
  }
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== src.sha256) throw new Error(`${src.id}: checksum mismatch (got ${hash})`);
  writeFileSync(file, bytes);
  return bytes.toString("utf8");
}

async function main() {
  rmSync(outDir, { recursive: true, force: true });
  const list: TranslationInfo[] = [];
  for (const src of SOURCES) {
    console.log(`${src.name}`);
    const text = src.parse(await fetchSource(src));
    const { url: _u, sha256: _s, parse: _p, ...info } = src;
    const index: BibleIndex = { ...info, books: [] };
    const dir = join(outDir, src.id);
    mkdirSync(dir, { recursive: true });
    for (const b of BOOKS) {
      const chapters = text.get(b.usfm);
      if (!chapters) throw new Error(`${src.id}: book ${b.usfm} missing`);
      const book: BibleBook = { book: b.usfm, chapters };
      writeFileSync(join(dir, `${b.usfm}.json`), JSON.stringify(book));
      index.books.push({ id: b.usfm, verses: chapters.map((c) => c.length) });
    }
    writeFileSync(join(dir, "index.json"), JSON.stringify(index));
    list.push(info);
    console.log(`  ${text.size} books, ${verseCount(text)} verses → bibles/${src.id}/`);
  }
  writeFileSync(join(outDir, "translations.json"), JSON.stringify(list, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
