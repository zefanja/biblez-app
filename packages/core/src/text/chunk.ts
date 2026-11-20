import { wordCount } from "./words";

export interface ChunkOptions {
  /** Chunks with fewer words are merged with a neighbour. */
  minWords: number;
  /** Two clauses are only merged when the result stays at or below this. */
  maxWords: number;
}

export const DEFAULT_CHUNK_OPTIONS: ChunkOptions = { minWords: 3, maxWords: 7 };

/** Splits after clause punctuation, keeping the punctuation (and closing quotes) on the left. */
function splitClauses(text: string): string[] {
  const parts = text.match(/[^,;:.!?–—]+(?:[,;:.!?–—]+["'»«”’)\]]*|$)/gu) ?? [text];
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/** Words before which a long clause reads naturally split (conjunctions, prepositions). */
const BREAK_WORDS = new Set([
  // German
  "und", "denn", "aber", "sondern", "oder", "daß", "dass", "damit", "auf", "um", "im", "in", "zum", "zur", "vor",
  "mit", "wie", "als", "wenn", "weil", "bis", "von", "über", "nach", "bei", "durch", "für", "gegen", "ohne", "unter",
  // English
  "and", "but", "or", "for", "that", "so", "of", "in", "on", "through", "before", "with", "to", "from", "by",
  "into", "unto", "because", "when", "which", "who",
]);

/** A clause longer than this is split further. */
const LONG_CLAUSE_WORDS = 8;

/** Splits an over-long clause, preferring a break word near the middle. */
function splitLong(clause: string, maxWords: number): string[] {
  const words = clause.split(/\s+/).filter(Boolean);
  if (words.length <= Math.max(maxWords, LONG_CLAUSE_WORDS)) return [clause];
  const middle = words.length / 2;
  let best = -1;
  for (let i = 3; i <= words.length - 3; i++) {
    const w = words[i]!.toLowerCase().replace(/[^\p{L}]/gu, "");
    if (BREAK_WORDS.has(w) && (best < 0 || Math.abs(i - middle) < Math.abs(best - middle))) best = i;
  }
  if (best < 0) best = Math.round(middle);
  return [
    ...splitLong(words.slice(0, best).join(" "), maxWords),
    ...splitLong(words.slice(best).join(" "), maxWords),
  ];
}

/**
 * Splits one verse into short, learnable chunks.
 *
 * Rules (product brief 4.2): split at punctuation, aim for 3–7 words,
 * merge a clause into its predecessor when one of them is short and the
 * result stays within `maxWords`; a tiny trailing chunk is always merged.
 */
export function chunkVerse(text: string, options: ChunkOptions = DEFAULT_CHUNK_OPTIONS): string[] {
  const { minWords, maxWords } = options;
  const clauses = splitClauses(text.trim()).flatMap((c) => splitLong(c, maxWords));
  const result: string[] = [];
  for (const clause of clauses) {
    const last = result[result.length - 1];
    if (last !== undefined) {
      const a = wordCount(last);
      const b = wordCount(clause);
      const oneIsShort = a <= minWords || b <= minWords; // e.g. "auf daß alle,"
      const oneIsTiny = a < minWords || b < minWords; // e.g. "Amen."
      if ((oneIsShort && a + b <= maxWords) || (oneIsTiny && a + b <= maxWords + 2)) {
        result[result.length - 1] = `${last} ${clause}`;
        continue;
      }
    }
    result.push(clause);
  }
  return result.length > 0 ? result : [text.trim()];
}

// ------------------------------------------------------------- manual edits

/** Joins chunk `index` with the following one. */
export function mergeChunks(chunks: string[], index: number): string[] {
  if (index < 0 || index >= chunks.length - 1) return chunks;
  return [...chunks.slice(0, index), `${chunks[index]} ${chunks[index + 1]}`, ...chunks.slice(index + 2)];
}

/** Splits chunk `index` before word number `wordIndex` (1 … words-1). */
export function splitChunk(chunks: string[], index: number, wordIndex: number): string[] {
  const words = (chunks[index] ?? "").split(/\s+/).filter(Boolean);
  if (wordIndex <= 0 || wordIndex >= words.length) return chunks;
  return [...chunks.slice(0, index), words.slice(0, wordIndex).join(" "), words.slice(wordIndex).join(" "), ...chunks.slice(index + 1)];
}
