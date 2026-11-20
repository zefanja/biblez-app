// SqlDriver on top of sql.js (web app and tests). sql.js is synchronous, the
// driver just wraps it in promises; batch() runs inside one transaction.

import type { Database } from "sql.js";
import type { SqlDriver, SqlValue, Statement } from "./store";

export function sqlJsDriver(db: Database, onWrite?: () => void): SqlDriver {
  const all = <T,>(sql: string, params: SqlValue[] = []): T[] => {
    const res = db.exec(sql, params)[0];
    if (!res) return [];
    return res.values.map((row) => Object.fromEntries(res.columns.map((c, i) => [c, row[i] ?? null]))) as T[];
  };
  return {
    async run(sql, params = []) {
      db.run(sql, params);
      onWrite?.();
    },
    async all<T>(sql: string, params: SqlValue[] = []) {
      return all<T>(sql, params);
    },
    async batch(statements: Statement[]) {
      db.run("BEGIN");
      try {
        for (const s of statements) db.run(s.sql, s.params ?? []);
        db.run("COMMIT");
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      }
      onWrite?.();
    },
  };
}
