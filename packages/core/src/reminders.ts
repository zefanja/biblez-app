// Daily reminder planning. Instead of one fixed repeating notification, the
// app schedules the next few days individually, each with what is really due
// that day – and no reminder at all on days with nothing to do (no nagging).

import { buildQueue, type Snapshot } from "./engine";
import { DEFAULT_SETTINGS, type Settings } from "./model";

export interface ReminderTime {
  hour: number;
  minute: number;
}

export interface PlannedReminder {
  /** Timestamp (ms) at which the notification should appear. */
  at: number;
  /** Day offset from today (0 = today). */
  day: number;
  reviews: number;
  fresh: number;
}

export const REMINDER_DAYS = 7;

export function planReminders(
  snapshot: Snapshot,
  time: ReminderTime,
  now: number = Date.now(),
  settings: Settings = DEFAULT_SETTINGS,
  days: number = REMINDER_DAYS,
): PlannedReminder[] {
  const base = new Date(now);
  const plan: PlannedReminder[] = [];
  for (let day = 0; day < days; day++) {
    const at = new Date(base.getFullYear(), base.getMonth(), base.getDate() + day, time.hour, time.minute, 0, 0).getTime();
    if (at <= now) continue;
    const queue = buildQueue(snapshot, at, settings);
    const reviews = queue.now.filter((s) => !s.isNew).length + queue.later.length;
    const fresh = queue.now.filter((s) => s.isNew).length;
    if (reviews + fresh === 0) continue;
    plan.push({ at, day, reviews, fresh });
  }
  return plan;
}
