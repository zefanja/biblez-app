// App state: a sql.js SQLite database (same schema as on mobile), persisted
// to IndexedDB after every change. Components subscribe via useApp().

import initSqlJs, { type Database } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { useSyncExternalStore } from "react";
import {
  applyReview, createCollection, deleteCollection, exportApkg, initSchema, loadSettings, loadSnapshot,
  makeBackup, parseBackup, reactivate, restoreBackup, saveCards, saveCollection, saveReview, saveSettings,
  type Card, type NewCollectionInput, type Rating, type ReviewResult, type Settings, type Snapshot,
  type SqlDriver, type SqlValue,
} from "@biblez/core";

export type Theme = "auto" | "light" | "dark";
export type FontSize = "s" | "m" | "l";
export type Lang = "de" | "en";

export interface UiPrefs {
  onboarded: boolean;
  theme: Theme;
  fontSize: FontSize;
  lang: Lang;
}

export interface AppState {
  ready: boolean;
  error: string | null;
  snapshot: Snapshot;
  settings: Settings;
  ui: UiPrefs;
  /** Bumped on every change so React re-renders. */
  version: number;
}

const DB_NAME = "biblez";
const STORE = "kv";
const KEY = "collection.sqlite";

let idbConn: Promise<IDBDatabase> | null = null;
function idbOpen(): Promise<IDBDatabase> {
  idbConn ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result);
  });
  return idbConn;
}

/** Runs one request and resolves only once its transaction has committed. */
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const conn = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(STORE, mode, { durability: "strict" } as IDBTransactionOptions);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function defaultLang(): Lang {
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
}

let SQL: initSqlJs.SqlJsStatic | null = null;
let db: Database | null = null;
let driver: SqlDriver | null = null;
let state: AppState = {
  ready: false,
  error: null,
  snapshot: { collections: [], segments: [], cards: [], reviews: [] },
  settings: loadSettingsFallback(),
  ui: { onboarded: false, theme: "auto", fontSize: "m", lang: defaultLang() },
  version: 0,
};
function loadSettingsFallback(): Settings {
  return { newSegmentsPerDay: 5, desiredRetention: 0.9, unlockStabilityDays: 7, safeStabilityDays: 21, dayStartHour: 4, allStagesAtOnce: false };
}

const listeners = new Set<() => void>();
function emit(patch: Partial<AppState>) {
  state = { ...state, ...patch, version: state.version + 1 };
  listeners.forEach((l) => l());
}

// Writes are coalesced (one per task) and strictly sequential, so an older
// snapshot can never overwrite a newer one.
let dirty = false;
let writing: Promise<void> = Promise.resolve();
function persist() {
  if (dirty) return;
  dirty = true;
  queueMicrotask(() => {
    writing = writing.then(async () => {
      if (!db || !dirty) return;
      dirty = false;
      const bytes = db.export();
      await idb("readwrite", (s) => s.put(bytes, KEY));
    }).catch((e) => console.error("persist failed", e));
  });
}

/** Resolves when every pending change is stored (used before export/reload in tests). */
export function flush(): Promise<void> {
  return writing;
}

function makeDriver(d: Database): SqlDriver {
  return {
    run: (sql, params = []) => void d.run(sql, params),
    all: <T,>(sql: string, params: SqlValue[] = []) => {
      const res = d.exec(sql, params)[0];
      if (!res) return [] as T[];
      return res.values.map((row) => Object.fromEntries(res.columns.map((c, i) => [c, row[i] ?? null]))) as T[];
    },
  };
}

function loadUi(d: SqlDriver): UiPrefs {
  const row = d.all<{ value: string }>("SELECT value FROM meta WHERE key = 'ui'")[0];
  const base: UiPrefs = { onboarded: false, theme: "auto", fontSize: "m", lang: defaultLang() };
  if (!row) return base;
  try {
    return { ...base, ...(JSON.parse(row.value) as Partial<UiPrefs>) };
  } catch {
    return base;
  }
}

export async function initStore(): Promise<void> {
  try {
    SQL = await initSqlJs({ locateFile: () => wasmUrl, useOldExtensionFunctions: false });
    let bytes: Uint8Array | undefined;
    try {
      bytes = await idb<Uint8Array | undefined>("readonly", (s) => s.get(KEY) as IDBRequest<Uint8Array | undefined>);
    } catch (e) {
      console.warn("IndexedDB unavailable, data will not persist", e);
    }
    db = bytes ? new SQL.Database(bytes) : new SQL.Database();
    driver = makeDriver(db);
    initSchema(driver);
    emit({ ready: true, snapshot: loadSnapshot(driver), settings: loadSettings(driver), ui: loadUi(driver) });
  } catch (e) {
    emit({ ready: true, error: String(e) });
  }
}

function d(): SqlDriver {
  if (!driver) throw new Error("store not ready");
  return driver;
}

/** Re-reads everything from SQLite (cheap at this size) and notifies. */
function refresh() {
  emit({ snapshot: loadSnapshot(d()), settings: loadSettings(d()) });
  persist();
}

export const actions = {
  addCollection(input: NewCollectionInput): string {
    const created = createCollection(input, Date.now(), state.settings);
    saveCollection(d(), created);
    refresh();
    return created.collection.id;
  },
  review(cardId: string, rating: Rating, durationMs: number): ReviewResult {
    const snap = loadSnapshot(d());
    const result = applyReview(snap, cardId, rating, Date.now(), durationMs, state.settings);
    saveReview(d(), result.review);
    saveCards(d(), result.changedCards);
    refresh();
    return result;
  },
  reactivate(card: Card) {
    saveCards(d(), [reactivate({ ...card })]);
    refresh();
  },
  deleteCollection(id: string) {
    deleteCollection(d(), id);
    refresh();
  },
  updateSettings(patch: Partial<Settings>) {
    saveSettings(d(), { ...state.settings, ...patch });
    refresh();
  },
  updateUi(patch: Partial<UiPrefs>) {
    const ui = { ...state.ui, ...patch };
    d().run("INSERT OR REPLACE INTO meta (key, value) VALUES ('ui', ?)", [JSON.stringify(ui)]);
    emit({ ui });
    persist();
  },
  exportAnki(): { blob: Blob; notes: number; reviews: number } {
    if (!SQL) throw new Error("store not ready");
    const res = exportApkg(SQL, state.snapshot, { settings: state.settings });
    return { blob: new Blob([res.bytes as BlobPart], { type: "application/octet-stream" }), notes: res.noteCount, reviews: res.reviewCount };
  },
  backup(): Blob {
    return new Blob([JSON.stringify(makeBackup(state.snapshot, state.settings))], { type: "application/json" });
  },
  restore(json: string) {
    restoreBackup(d(), parseBackup(json));
    refresh();
  },
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
