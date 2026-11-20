// Word-level transformations used by the hint stages.
// Same tokenisation as the Anki add-on (gen_notes.py), but Unicode-aware.

const TOKEN_RE = /[\p{L}\p{N}_]+|[^\p{L}\p{N}_\s]|\s+/gu;
const WORD_RE = /^[\p{L}\p{N}_]+$/u;

function tokenize(text: string): string[] {
  return text.match(TOKEN_RE) ?? [];
}

/** Stage 1: replaces the last letter of every word with "_" ("Gott" → "Got_"). */
export function maskLastLetters(text: string): string {
  return tokenize(text)
    .map((t) => (WORD_RE.test(t) ? t.slice(0, -1) + "_" : t))
    .join("");
}

/** Stage 2: keeps only the first letter of every word ("Also hat Gott" → "A h G"). */
export function firstLetters(text: string): string {
  return tokenize(text)
    .map((t) => (WORD_RE.test(t) ? t[0] : t))
    .join("");
}

export function wordCount(text: string): number {
  return tokenize(text).filter((t) => WORD_RE.test(t)).length;
}
