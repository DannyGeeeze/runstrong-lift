// Calendar-date helpers. All dates are local calendar days as "YYYY-MM-DD" strings.
// Math is done in UTC on those strings so DST never shifts a day.

import type { Weekday } from "./types";

export const WEEKDAYS: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Today's date in the device's local timezone. */
export function todayLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * 86_400_000);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(b) - toUtc(a)) / 86_400_000);
}

export function weekdayOf(date: string): Weekday {
  return WEEKDAYS[new Date(toUtc(date)).getUTCDay()];
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  const dow = new Date(toUtc(date)).getUTCDay(); // 0 = Sun
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

/** The date in the same Mon–Sun week as `date` that falls on `day`. */
export function dayInWeek(date: string, day: Weekday): string {
  const offset = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 }[day];
  return addDays(mondayOf(date), offset);
}

export function formatDay(date: string): string {
  return new Date(toUtc(date)).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
