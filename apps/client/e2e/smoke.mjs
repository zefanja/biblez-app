// End-to-end smoke test: drives the built web app in Chromium (phone size).
// Usage: pnpm build && node e2e/smoke.mjs [screenshotDir]
import { spawn } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const port = 4319;
const server = spawn("npx", ["vite", "preview", "--port", String(port), "--strictPort"], { stdio: "pipe", detached: true });
server.stderr.on("data", (d) => process.stderr.write(d));
for (let i = 0; ; i++) {
  try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch {}
  if (i > 100) throw new Error("preview server did not start");
  await new Promise((r) => setTimeout(r, 200));
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "de-DE", acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const shot = async (name) => shots && page.screenshot({ path: `${shots}/${name}.png` });
const step = (msg) => console.log("✓", msg);

try {
  await page.goto(`http://localhost:${port}/`);
  await page.getByRole("button", { name: "Mit Johannes 3,16 beginnen" }).waitFor();
  await shot("01-welcome"); step("welcome screen");

  await page.getByRole("button", { name: "Mit Johannes 3,16 beginnen" }).click();
  await page.getByText("Lies den Vers in Ruhe").waitFor();
  const chunks = await page.locator(".chunk").count();
  if (chunks !== 5) throw new Error(`expected 5 chunks, got ${chunks}`);
  await shot("02-read"); step("read screen shows 5 chunks");

  await page.getByRole("button", { name: "Ich bin bereit" }).click();
  await page.getByRole("button", { name: "Aufdecken" }).waitFor();
  let answers = 0;
  for (let i = 0; i < 20; i++) {
    const reveal = page.getByRole("button", { name: "Aufdecken" });
    if (!(await reveal.isVisible().catch(() => false))) break;
    if (i === 0) await shot("03-card");
    await reveal.click();
    if (i === 0) await shot("04-revealed");
    // first card: "Nochmal" once, it must come back in the same session
    await page.getByRole("button", { name: i === 0 ? "Nochmal" : "Gut", exact: true }).click();
    answers++;
  }
  await page.getByText("Geschafft!").waitFor({ timeout: 5000 });
  // 5 chunks; each comes back once for its 10-minute step, the "again" card twice
  if (answers !== 11) throw new Error(`expected 11 answers, got ${answers}`);
  await shot("05-done");
  step(`studied ${answers} answers: 5 chunks, second learning step kept, "again" repeated`);

  // "again" sends the card to a 1-minute step; the session may wait for it.
  await page.goto(`http://localhost:${port}/#/`);
  await page.getByRole("heading", { name: "Heute" }).waitFor();
  await shot("06-today"); step("today screen");

  await page.reload();
  await page.getByRole("heading", { name: "Heute" }).waitFor();
  const persisted = await page.getByText("Johannes 3,16").first().isVisible();
  if (!persisted) throw new Error("collection not persisted after reload");
  step("data persists across reload (IndexedDB)");

  await page.goto(`http://localhost:${port}/#/add`);
  await page.getByRole("button", { name: "Eigener Text" }).click();
  await page.getByLabel("Titel").fill("Philipper 4,6–7");
  await page.getByLabel("Text einfügen").fill("6 Sorget nichts! sondern in allen Dingen lasset eure Bitten im Gebet und Flehen mit Danksagung vor Gott kund werden. 7 Und der Friede Gottes, welcher höher ist denn alle Vernunft, bewahre eure Herzen und Sinne in Christo Jesu!");
  await page.getByText(/2 Verse, \d+ Abschnitte erkannt/).waitFor();
  const before = await page.locator(".chunk-box").count();
  await page.locator(".chunk-main").first().click();
  await page.getByRole("button", { name: "Vor „nichts!“ trennen" }).click();
  if ((await page.locator(".chunk-box").count()) !== before + 1) throw new Error("split did not add a chunk");
  await shot("07-add-text");
  await page.getByRole("button", { name: /verbinden$/ }).first().click();
  if ((await page.locator(".chunk-box").count()) !== before) throw new Error("merge did not remove a chunk");
  await page.locator(".chunk-main").nth(1).click();
  await page.locator(".word-chip:not([disabled])").first().click();
  const custom = await page.locator(".chunk-box").count();
  step(`custom text: ${before} chunks detected, split + merge work (now ${custom})`);
  await page.getByRole("button", { name: "Sammlung anlegen" }).click();
  await page.getByText("Lies den Vers in Ruhe").waitFor();
  const created = await page.locator(".chunk").count();
  if (created !== custom) throw new Error(`collection has ${created} chunks, editor had ${custom}`);
  step("custom collection created with the edited chunks");

  // Bible reference from a bundled free translation
  await page.goto(`http://localhost:${port}/#/add`);
  await page.getByLabel("Übersetzung").selectOption("sch1951");
  await page.getByLabel("Stelle").fill("Joh 30,1");
  await page.getByText("Dieses Kapitel gibt es in dem Buch nicht.").waitFor();
  await page.getByLabel("Stelle").fill("Röm 8,28-30");
  await page.getByText("Römer 8,28–30", { exact: true }).waitFor();
  await page.getByText(/3 Verse, \d+ Abschnitte erkannt/).waitFor();
  const firstChunk = await page.locator(".chunk-main .verse").first().textContent();
  if (!firstChunk?.startsWith("Wir wissen aber")) throw new Error(`unexpected Schlachter text: ${firstChunk}`);
  await shot("08a-add-reference");
  step("reference: errors shown, Röm 8,28-30 loaded from Schlachter 1951");
  await page.getByLabel("Übersetzung").selectOption("kjv");
  await page.getByLabel("Stelle").fill("");
  await page.getByRole("button", { name: "Psalm 23" }).click();
  await page.getByText(/6 Verse, \d+ Abschnitte erkannt/).waitFor();
  if (!(await page.getByText("The LORD is my shepherd;", { exact: true }).count())) throw new Error("KJV Psalm 23 missing");
  await page.getByRole("button", { name: "Sammlung anlegen" }).click();
  await page.getByText("Lies den Vers in Ruhe").waitFor();
  step("suggestion chip → KJV Psalm 23 created");

  await page.goto(`http://localhost:${port}/#/verses`);
  await page.getByRole("heading", { name: "Meine Verse" }).waitFor();
  await shot("08-verses"); step("verses list");

  await page.getByRole("button", { name: "Rezitieren" }).first().click();
  await page.getByText("Zählt nicht für deinen Lernplan").waitFor();
  await page.getByRole("button", { name: "Nächster Vers" }).click().catch(() => {});
  await shot("09-recite"); step("recite screen");

  await page.goto(`http://localhost:${port}/#/settings`);
  const stats = await page.getByText(/Abschnitte · \d+ Wiederholungen/).textContent();
  if (!/· 11 Wiederholungen/.test(stats ?? "")) throw new Error(`reviews not persisted: ${stats}`);
  step(`learning history survived reload (${stats})`);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: ".apkg-Datei erstellen" }).click()]);
  const path = await dl.path();
  const size = statSync(path).size;
  if (size < 2000) throw new Error(`apkg too small: ${size}`);
  await dl.saveAs("/tmp/biblez-e2e.apkg");
  await shot("10-settings"); step(`Anki export downloaded (${size} bytes)`);

  await page.getByRole("button", { name: "Dunkel" }).click();
  await page.goto(`http://localhost:${port}/#/`);
  await page.getByRole("heading", { name: "Heute" }).waitFor();
  await shot("11-today-dark"); step("dark mode");

  if (errors.length) throw new Error("console errors:\n" + errors.join("\n"));
  console.log("\nE2E PASS");
} catch (e) {
  await shot("zz-failure");
  console.error("\nE2E FAIL:", e.message, errors.length ? "\n" + errors.join("\n") : "");
  process.exitCode = 1;
} finally {
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
}
