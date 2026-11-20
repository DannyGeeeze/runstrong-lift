// The coach's plyo template ("Easy plyo template you can use"):
//   - 2 sessions a week, 48 hours between (the weekly cap and the 48h rule in rules.ts)
//   - 2 movements per session, 2-3 sets each, counted in contacts or meters
//   - Day 1: a bilateral in-place up-and-down move (drop jump, pogo...) + a skipping variation
//   - Day 2: a single-leg move (in place or travelling) + a lateral move
// Days alternate: the next plyo session is the other day from the last one.

import { getExercise, isPlyo } from "../exercises";
import type { Exercise, LiftLog } from "../types";

export type PlyoFamily = "updown" | "skip" | "single" | "lateral";
export type PlyoDay = 1 | 2;

export const PLYO_DAY: Record<PlyoDay, [PlyoFamily, PlyoFamily]> = {
  1: ["updown", "skip"],
  2: ["single", "lateral"],
};

export const PLYO_FAMILY_LABEL: Record<PlyoFamily, string> = {
  updown: "Up & down",
  skip: "Skipping",
  single: "Single-leg",
  lateral: "Lateral",
};

const SINGLE_LEG = /single-leg|(^|-)sl-|hop|split|bss|ffess|deceleration|step-up/;

/** Which part of the template a plyo belongs to. */
export function plyoFamily(e: Exercise): PlyoFamily | null {
  if (!isPlyo(e)) return null;
  if (e.plyo_type === "lateral") return "lateral";
  if (e.plyo_type === "rhythm") return "skip";
  if (SINGLE_LEG.test(e.id)) return "single";
  return "updown";
}

/** Day 2 if the last plyo session (before today) was a Day 1, otherwise Day 1. */
export function nextPlyoDay(history: LiftLog[], today: string): PlyoDay {
  const last = history
    .filter((h) => h.hadPlyo && h.date < today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!last) return 1;
  const families = last.exerciseIds.map((id) => getExercise(id)).flatMap((e) => (e ? [plyoFamily(e)] : []));
  if (families.includes("single") || families.includes("lateral")) return 1;
  if (families.includes("updown") || families.includes("skip")) return 2;
  return 1;
}

/** Count plyos in contacts or meters: "3-5" → "3-5 contacts", "6/side" → "6 contacts/side". Meters stay as they are. */
export function plyoReps(reps: string): string {
  if (/contact|\bm\b|\d m$/.test(reps)) return reps;
  const side = reps.match(/^(\d+(?:-\d+)?)\/side$/);
  if (side) return `${side[1]} contacts/side`;
  if (/^\d+(-\d+)?$/.test(reps)) return `${reps} contacts`;
  return reps;
}
