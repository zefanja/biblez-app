// SqlDriver on top of @capacitor-community/sqlite (Android/iOS). Only the four
// connection methods used here are typed, so the core stays free of plugin imports.

import type { SqlDriver, SqlValue, Statement } from "./store";

export interface CapacitorSqliteConnection {
  run(statement: string, values?: unknown[], transaction?: boolean): Promise<unknown>;
  query(statement: string, values?: unknown[]): Promise<{ values?: unknown[] }>;
  execute(statements: string, transaction?: boolean): Promise<unknown>;
  executeSet(set: { statement: string; values?: unknown[] }[], transaction?: boolean): Promise<unknown>;
}

export function capacitorSqliteDriver(conn: CapacitorSqliteConnection): SqlDriver {
  return {
    async run(sql: string, params: SqlValue[] = []) {
      // PRAGMAs must not run inside the transaction the plugin wraps around run()
      if (/^\s*PRAGMA/i.test(sql)) await conn.execute(sql, false);
      else await conn.run(sql, params, true);
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      const res = await conn.query(sql, params);
      return (res.values ?? []) as T[];
    },
    async batch(statements: Statement[]) {
      if (!statements.length) return;
      await conn.executeSet(statements.map((s) => ({ statement: s.sql, values: s.params ?? [] })), true);
    },
  };
}
