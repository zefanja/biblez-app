// Builds .out/sample.apkg with 30 days of simulated learning history plus
// .out/sample.expected.json, which tools/anki_verify.py compares against
// what real Anki makes of the file after importing it.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import initSqlJs from "sql.js";
import {
  applyReview, buildQueue, cardStatus, createCollection, DEFAULT_SETTINGS, emptySnapshot, exportApkg, SAMPLES, State,
  daysBetween, dayStart, type Snapshot,
} from "../src";

const DAY = 86_400_000;
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", ".out");

export function simulate(now: number, days = 30): Snapshot {
  const snap = emptySnapshot();
  const start = dayStart(now, DEFAULT_SETTINGS.dayStartHour) - days * DAY + 9 * 3_600_000;
  for (const sample of [SAMPLES[0]!, SAMPLES[1]!]) {
    const c = createCollection({ title: sample.title, verses: sample.verses, translation: sample.translation, source: "bundled" }, start);
    snap.collections.push(c.collection);
    snap.segments.push(...c.segments);
    snap.cards.push(...c.cards);
  }
  let rnd = 42;
  const random = () => ((rnd = (rnd * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
  for (let d = 0; d < days; d++) {
    if (d % 7 === 5) continue; // skip a day each week → some overdue cards
    let t = start + d * DAY;
    for (let guard = 0; guard < 300; guard++) {
      const q = buildQueue(snap, t);
      const next = q.now[0] ?? (q.later[0] && q.later[0].due - t < 30 * 60_000 ? q.later[0] : undefined);
      if (!next) break;
      t = Math.max(t, next.due) + 3_000 + Math.floor(random() * 5_000);
      applyReview(snap, next.card.id, random() < 0.15 ? "again" : "good", t, 3_000 + Math.floor(random() * 9_000));
    }
  }
  // leave one card in (re)learning at export time
  const lastDay = start + days * DAY - 3_600_000;
  const review = buildQueue(snap, lastDay).now.find((s) => !s.isNew);
  if (review) applyReview(snap, review.card.id, "again", Math.min(lastDay, now - 60_000), 5_000);
  return snap;
}

async function main() {
  const now = Date.now();
  const snap = simulate(now);
  const SQL = await initSqlJs();
  const result = exportApkg(SQL, snap, { now });
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "sample.apkg"), result.bytes);

  const settings = DEFAULT_SETTINGS;
  const cards = snap.cards.map((card) => {
    const st = cardStatus(snap, card, now, settings);
    const reviewed = !st.isNew;
    return {
      ankiCardId: card.ankiCardId,
      stage: card.stage,
      suspended: card.retiredAt !== null,
      state: reviewed ? State[st.fsrs.state] : "New",
      dueInDays: reviewed && st.fsrs.state === State.Review ? daysBetween(now, st.due, settings.dayStartHour) : null,
      dueEpochSec: reviewed && st.fsrs.state !== State.Review ? Math.floor(st.due / 1000) : null,
      stability: reviewed ? st.fsrs.stability : null,
      difficulty: reviewed ? st.fsrs.difficulty : null,
      reps: st.fsrs.reps,
      lapses: st.fsrs.lapses,
    };
  });
  const expected = {
    notes: result.noteCount,
    cards: result.cardCount,
    reviews: result.reviewCount,
    decks: snap.collections.map((c) => `BibleZ::${c.title}`),
    stage3Generated: true,
    cardsDetail: cards,
  };
  writeFileSync(join(outDir, "sample.expected.json"), JSON.stringify(expected, null, 2));
  console.log(`sample.apkg: ${result.noteCount} notes, ${result.cardCount} cards, ${result.reviewCount} reviews`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
