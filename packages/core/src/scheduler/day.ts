// Learning days start at `dayStartHour` local time (Anki: "next day starts at").

const DAY_MS = 86_400_000;

/** Timestamp (ms) at which the learning day containing `ts` started. */
export function dayStart(ts: number, dayStartHour: number): number {
  const d = new Date(ts);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), dayStartHour, 0, 0, 0);
  if (start.getTime() > ts) start.setDate(start.getDate() - 1);
  return start.getTime();
}

/** Start of the following learning day. */
export function nextDayStart(ts: number, dayStartHour: number): number {
  const s = new Date(dayStart(ts, dayStartHour));
  s.setDate(s.getDate() + 1);
  return s.getTime();
}

/** Whole learning days between two timestamps (DST-safe). */
export function daysBetween(from: number, to: number, dayStartHour: number): number {
  return Math.round((dayStart(to, dayStartHour) - dayStart(from, dayStartHour)) / DAY_MS);
}
