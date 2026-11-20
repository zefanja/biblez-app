// Imports the Anki fixture into BibleZ and exports it again (.out/roundtrip.apkg)
// for tools/anki_verify_roundtrip.py.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import initSqlJs from "sql.js";
import { exportApkg, importAnkiPackage, initSchema, loadSnapshot, saveImport, sqlJsDriver } from "../src";
const SQL = await initSqlJs();
const res = importAnkiPackage(SQL, new Uint8Array(readFileSync(new URL("../test/fixtures/anki-modern.apkg", import.meta.url))));
const db = sqlJsDriver(new SQL.Database()); await initSchema(db);
await saveImport(db, res.created, res.reviews);
mkdirSync(new URL("../.out/", import.meta.url), { recursive: true });
writeFileSync(new URL("../.out/roundtrip.apkg", import.meta.url), exportApkg(SQL, await loadSnapshot(db)).bytes);
console.log("exported", res.report.segments, "segments,", res.report.reviews, "reviews");
