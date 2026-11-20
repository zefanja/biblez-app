import { autoFormatVerses } from "./formatter";

export interface Verse {
  number: string;
  text: string;
}

/**
 * Turns pasted text into verses. Verse numbers are detected by the
 * auto-formatter (also superscripts); lines without a number continue the
 * previous verse. Text without any verse number becomes verse "1".
 */
export function parseVerses(raw: string): Verse[] {
  const formatted = autoFormatVerses(raw);
  const verses: Verse[] = [];
  for (const line of formatted.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const m = trimmed.match(/^(\d{1,3})\s+(.*)$/);
    if (m) {
      verses.push({ number: m[1] ?? "", text: (m[2] ?? "").trim() });
    } else if (verses.length > 0) {
      const last = verses[verses.length - 1]!;
      last.text = `${last.text} ${trimmed}`;
    } else {
      verses.push({ number: "1", text: trimmed });
    }
  }
  return verses;
}
