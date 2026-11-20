// Identifier helpers. Anki note/card ids are millisecond-based integers;
// GUIDs are 10 characters from Anki's base91 alphabet.

const GUID_ALPHABET =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&()*+,-./:;<=>?@[]^_`{|}~";

function randomInt(max: number): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const buf = new Uint32Array(1);
    c.getRandomValues(buf);
    return buf[0]! % max;
  }
  return Math.floor(Math.random() * max);
}

export function ankiGuid(): string {
  let out = "";
  for (let i = 0; i < 10; i++) out += GUID_ALPHABET[randomInt(GUID_ALPHABET.length)];
  return out;
}

let lastAnkiId = 0;
/** Unique, increasing millisecond-style ids (Anki note, card and deck ids). */
export function nextAnkiId(now: number = Date.now()): number {
  lastAnkiId = Math.max(lastAnkiId + 1, now);
  return lastAnkiId;
}

/** Sortable unique id (time prefix + randomness), used for app records. */
export function uid(now: number = Date.now()): string {
  const time = now.toString(36).padStart(9, "0");
  let rand = "";
  for (let i = 0; i < 10; i++) rand += randomInt(36).toString(36);
  return time + rand;
}
