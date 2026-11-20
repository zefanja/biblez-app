// App state. The database (native SQLite on the phone, sql.js + IndexedDB on
// the web, see db.ts) is the source of truth; the in-memory snapshot mirrors it
// so the UI stays fast. Components subscribe via useApp().

import { useSyncExternalStore } from "react";
import {
  applyReview, createCollection, DEFAULT_SETTINGS, deleteCollection, exportApkg, loadMeta, loadSettings, loadSnapshot,
  importAnkiPackage, makeBackup, parseBackup, reactivate, restoreBackup, saveCards, saveCollection, saveImport, saveMeta,
  saveReview, saveSettings, type AnkiImportResult, type Card, type NewCollectionInput, type Rating, type ReviewResult, type Settings, type Snapshot, type SqlDriver,
} from "@biblez/core";
import { getSqlJs, openDatabase, type DbKind } from "./db";

export type Theme = "auto" | "light" | "dark";
export type FontSize = "s" | "m" | "l";
export type Lang = "de" | "en";

export interface ReminderPrefs {
  enabled: boolean;
  hour: number;
  minute: number;
  /** The suggestion on the "done" screen was dismissed or accepted. */
  suggested: boolean;
}

export interface UiPrefs {
  onboarded: boolean;
  theme: Theme;
  fontSize: FontSize;
  lang: Lang;
  /** Last translation chosen when adding a passage. */
  translation?: string;
  reminder: ReminderPrefs;
}

export interface AppState {
  ready: boolean;
  error: string | null;
  dbKind: DbKind | null;
  snapshot: Snapshot;
  settings: Settings;
  ui: UiPrefs;
  /** Bumped on every change so React re-renders. */
  version: number;
}

function defaultLang(): Lang {
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
}

const DEFAULT_UI: UiPrefs = {
  onboarded: false,
  theme: "auto",
  fontSize: "m",
  lang: defaultLang(),
  reminder: { enabled: false, hour: 19, minute: 0, suggested: false },
};

let driver: SqlDriver | null = null;
let flushDb: () => Promise<void> = async () => undefined;
let state: AppState = {
  ready: false,
  error: null,
  dbKind: null,
  snapshot: { collections: [], segments: [], cards: [], reviews: [] },
  settings: { ...DEFAULT_SETTINGS },
  ui: DEFAULT_UI,
  version: 0,
};

const listeners = new Set<() => void>();
const changeHooks = new Set<(s: AppState) => void>();

function emit(patch: Partial<AppState>, notifyHooks = true) {
  state = { ...state, ...patch, version: state.version + 1 };
  listeners.forEach((l) => l());
  if (notifyHooks) changeHooks.forEach((h) => h(state));
}

/** Called after data or preference changes (used to reschedule reminders). */
export function onDataChange(hook: (s: AppState) => void): () => void {
  changeHooks.add(hook);
  return () => changeHooks.delete(hook);
}

function db(): SqlDriver {
  if (!driver) throw new Error("store not ready");
  return driver;
}

const cloneSnapshot = (s: Snapshot): Snapshot => ({
  collections: s.collections.map((c) => ({ ...c })),
  segments: s.segments.map((x) => ({ ...x })),
  cards: s.cards.map((k) => ({ ...k })),
  reviews: [...s.reviews],
});

/** Reloads everything from the database (after bulk changes or an error). */
async function reload() {
  emit({ snapshot: await loadSnapshot(db()), settings: await loadSettings(db()) });
}

export async function initStore(): Promise<void> {
  try {
    const opened = await openDatabase();
    driver = opened.driver;
    flushDb = opened.flush;
    const stored = await loadMeta<Partial<UiPrefs>>(driver, "ui", {});
    const ui: UiPrefs = { ...DEFAULT_UI, ...stored, reminder: { ...DEFAULT_UI.reminder, ...(stored.reminder ?? {}) } };
    emit({ ready: true, dbKind: opened.kind, snapshot: await loadSnapshot(driver), settings: await loadSettings(driver), ui });
  } catch (e) {
    emit({ ready: true, error: String(e) });
  }
}

export const actions = {
  async addCollection(input: NewCollectionInput): Promise<string> {
    const created = createCollection(input, Date.now(), state.settings);
    await saveCollection(db(), created);
    const snapshot = cloneSnapshot(state.snapshot);
    snapshot.collections.push(created.collection);
    snapshot.segments.push(...created.segments);
    snapshot.cards.push(...created.cards);
    emit({ snapshot });
    return created.collection.id;
  },

  async review(cardId: string, rating: Rating, durationMs: number): Promise<ReviewResult> {
    const snapshot = cloneSnapshot(state.snapshot);
    const result = applyReview(snapshot, cardId, rating, Date.now(), durationMs, state.settings);
    try {
      await saveReview(db(), result.review, result.changedCards);
    } catch (e) {
      await reload();
      throw e;
    }
    emit({ snapshot });
    return result;
  },

  async reactivate(card: Card) {
    await saveCards(db(), [reactivate({ ...card })]);
    await reload();
  },

  async deleteCollection(id: string) {
    await deleteCollection(db(), id);
    await reload();
  },

  async updateSettings(patch: Partial<Settings>) {
    const settings = { ...state.settings, ...patch };
    await saveSettings(db(), settings);
    emit({ settings });
  },

  async updateUi(patch: Partial<UiPrefs>) {
    const ui = { ...state.ui, ...patch };
    await saveMeta(db(), "ui", ui);
    emit({ ui });
  },

  async exportAnki(): Promise<{ blob: Blob; notes: number; reviews: number }> {
    const res = exportApkg(await getSqlJs(), state.snapshot, { settings: state.settings });
    return { blob: new Blob([res.bytes as BlobPart], { type: "application/octet-stream" }), notes: res.noteCount, reviews: res.reviewCount };
  },

  backup(): Blob {
    return new Blob([JSON.stringify(makeBackup(state.snapshot, state.settings))], { type: "application/json" });
  },

  async restore(json: string) {
    await restoreBackup(db(), parseBackup(json));
    await reload();
  },

  /** Reads an Anki export; nothing is stored yet (see commitAnkiImport). */
  async prepareAnkiImport(bytes: Uint8Array): Promise<AnkiImportResult> {
    const existingGuids = new Set(state.snapshot.segments.map((s) => s.ankiGuid));
    return importAnkiPackage(await getSqlJs(), bytes, { existingGuids, settings: state.settings });
  },

  async commitAnkiImport(result: AnkiImportResult) {
    await saveImport(db(), result.created, result.reviews);
    await reload();
  },

  /** Resolves when every change is stored durably (web: IndexedDB write finished). */
  flush: () => flushDb(),
};

export function useApp(): AppState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export function getState(): AppState {
  return state;
}
