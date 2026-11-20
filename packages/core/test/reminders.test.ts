import { describe, expect, it } from "vitest";
import { applyReview, buildQueue, createCollection, emptySnapshot, planReminders, SAMPLES, type Snapshot } from "../src";

const T0 = new Date(2026, 10, 20, 9, 0, 0).getTime(); // Fri 20 Nov 2026, 09:00
const EVENING = { hour: 19, minute: 0 };

function setup(): Snapshot {
  const snap = emptySnapshot();
  const c = createCollection({ title: "Johannes 3,16", verses: SAMPLES[0]!.verses }, T0 - 86_400_000);
  snap.collections.push(c.collection);
  snap.segments.push(...c.segments);
  snap.cards.push(...c.cards);
  return snap;
}

function studyAll(snap: Snapshot, at: number) {
  let t = at;
  for (let i = 0; i < 50; i++) {
    const next = buildQueue(snap, t).now[0];
    if (!next) break;
    t += 15_000;
    applyReview(snap, next.card.id, "good", t);
  }
}

describe("planReminders", () => {
  it("reminds today in the evening about new chunks", () => {
    const plan = planReminders(setup(), EVENING, T0);
    expect(plan[0]).toMatchObject({ day: 0, reviews: 0, fresh: 5 });
    expect(new Date(plan[0]!.at).getHours()).toBe(19);
  });

  it("skips today once everything is done and only plans days with due cards", () => {
    const snap = setup();
    studyAll(snap, T0);
    const plan = planReminders(snap, EVENING, T0 + 3_600_000);
    expect(plan.some((p) => p.day === 0)).toBe(false);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.length).toBeLessThan(7); // quiet days get no reminder
    for (const p of plan) expect(p.reviews + p.fresh).toBeGreaterThan(0);
  });

  it("does not schedule a time that has already passed", () => {
    const late = new Date(2026, 10, 20, 21, 0, 0).getTime();
    expect(planReminders(setup(), EVENING, late).every((p) => p.at > late)).toBe(true);
  });

  it("returns nothing without any verses", () => {
    expect(planReminders(emptySnapshot(), EVENING, T0)).toEqual([]);
  });
});
