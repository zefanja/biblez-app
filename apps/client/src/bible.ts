// Loads the generated Bible files (public/bibles, see `pnpm bibles`) on demand.

import type { BibleBook, BibleIndex, TranslationInfo } from "@biblez/core";

const BASE = "./bibles/";
const cache = new Map<string, Promise<unknown>>();

function load<T>(path: string): Promise<T> {
  let p = cache.get(path) as Promise<T> | undefined;
  if (!p) {
    p = fetch(BASE + path).then((r) => {
      if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
      return r.json() as Promise<T>;
    });
    p.catch(() => cache.delete(path)); // allow a retry after a network error
    cache.set(path, p);
  }
  return p;
}

export const loadTranslations = () => load<TranslationInfo[]>("translations.json");
export const loadIndex = (id: string) => load<BibleIndex>(`${id}/index.json`);
export const loadBook = (id: string, usfm: string) => load<BibleBook>(`${id}/${usfm}.json`);

export const DEFAULT_TRANSLATION: Record<"de" | "en", string> = { de: "lut1912", en: "bsb" };
