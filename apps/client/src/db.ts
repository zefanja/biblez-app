// Opens the app database behind the core's SqlDriver interface:
//  - native app (Android/iOS): SQLite via @capacitor-community/sqlite – a real
//    database file in the app's private storage
//  - web: SQLite via sql.js in memory, persisted to IndexedDB after each write
// The schema and all queries are the same (packages/core/src/store.ts).

import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";
import {
  capacitorSqliteDriver, initSchema, isEmpty, loadMeta, loadSettings, loadSnapshot, makeBackup, restoreBackup, saveMeta,
  sqlJsDriver, type SqlDriver,
} from "@biblez/core";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

export type DbKind = "native" | "web";

// ---------------------------------------------------------------- sql.js

let sqlPromise: Promise<SqlJsStatic> | null = null;
/** sql.js is also needed on native: the Anki export builds its .apkg with it. */
export function getSqlJs(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({ locateFile: () => wasmUrl, useOldExtensionFunctions: false });
  return sqlPromise;
}

// ------------------------------------------------------------- IndexedDB

const IDB_NAME = "biblez";
const IDB_STORE = "kv";
const IDB_KEY = "collection.sqlite";
let idbConn: Promise<IDBDatabase> | null = null;

function idbOpen(): Promise<IDBDatabase> {
  idbConn ??= new Promise((resolve, reject) => {
    const open = indexedDB.open(IDB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(IDB_STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result);
  });
  return idbConn;
}

/** Runs one request and resolves only once its transaction has committed. */
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const conn = await idbOpen();
  return new Promise((resolve, reject) => {
    const tx = conn.transaction(IDB_STORE, mode, { durability: "strict" } as IDBTransactionOptions);
    const req = fn(tx.objectStore(IDB_STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function readIdbBytes(): Promise<Uint8Array | undefined> {
  try {
    return await idb<Uint8Array | undefined>("readonly", (s) => s.get(IDB_KEY) as IDBRequest<Uint8Array | undefined>);
  } catch (e) {
    console.warn("IndexedDB unavailable", e);
    return undefined;
  }
}

/** Web: writes are coalesced and strictly sequential, so an older snapshot never overwrites a newer one. */
function persistingDriver(db: Database): { driver: SqlDriver; flush: () => Promise<void> } {
  let dirty = false;
  let writing: Promise<void> = Promise.resolve();
  const persist = () => {
    if (dirty) return;
    dirty = true;
    queueMicrotask(() => {
      writing = writing
        .then(async () => {
          if (!dirty) return;
          dirty = false;
          const bytes = db.export();
          await idb("readwrite", (s) => s.put(bytes, IDB_KEY));
        })
        .catch((e) => console.error("persist failed", e));
    });
  };
  return { driver: sqlJsDriver(db, persist), flush: () => writing };
}

// ---------------------------------------------------------------- native

const NATIVE_DB = "biblez";

async function openNative(): Promise<SqlDriver> {
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  await sqlite.checkConnectionsConsistency().catch(() => undefined);
  const existing = (await sqlite.isConnection(NATIVE_DB, false)).result;
  const conn = existing
    ? await sqlite.retrieveConnection(NATIVE_DB, false)
    : await sqlite.createConnection(NATIVE_DB, false, "no-encryption", 1, false);
  await conn.open();
  return capacitorSqliteDriver(conn);
}

/**
 * Data from an earlier app version lived in the WebView's IndexedDB. Move it
 * into the native database once (only if that is still empty).
 */
async function migrateFromWebView(target: SqlDriver): Promise<boolean> {
  if (!(await isEmpty(target))) return false;
  const bytes = await readIdbBytes();
  if (!bytes) return false;
  const SQL = await getSqlJs();
  const old = sqlJsDriver(new SQL.Database(bytes));
  const snapshot = await loadSnapshot(old);
  if (!snapshot.collections.length) return false;
  await restoreBackup(target, makeBackup(snapshot, await loadSettings(old)));
  await saveMeta(target, "ui", await loadMeta(old, "ui", {}));
  await saveMeta(target, "migrated_from_webview", { at: Date.now() });
  return true;
}

// ----------------------------------------------------------------- open

export interface OpenedDb {
  kind: DbKind;
  driver: SqlDriver;
  /** Resolves when all writes are stored durably. */
  flush: () => Promise<void>;
  migrated: boolean;
}

export async function openDatabase(): Promise<OpenedDb> {
  if (Capacitor.isNativePlatform()) {
    const driver = await openNative();
    await initSchema(driver);
    const migrated = await migrateFromWebView(driver).catch((e) => {
      console.error("migration from WebView storage failed", e);
      return false;
    });
    return { kind: "native", driver, flush: async () => undefined, migrated };
  }
  const SQL = await getSqlJs();
  const bytes = await readIdbBytes();
  const { driver, flush } = persistingDriver(bytes ? new SQL.Database(bytes) : new SQL.Database());
  await initSchema(driver);
  return { kind: "web", driver, flush, migrated: false };
}
