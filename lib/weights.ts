// Weight logging: which moves take a load, what you lifted last time, and new bests.
// Weights are pounds, stored per session in lift history.

import type { Exercise, LiftLog } from "./types";

/** Gear that means the move is loaded and worth logging a weight for. */
const LOADED = /barbell|dumbbell|kettlebell|trap bar|safety bar|landmine|plate|cable|leg press|belt squat|sled|machine|med ball|weight vest/;

export function isLoaded(e: Exercise): boolean {
  return !!e.equipment && LOADED.test(e.equipment.toLowerCase());
}

export interface LastTime {
  date: string;
  weights: number[];
}

/** The most recent session where you logged a weight for this exercise. */
export function lastTime(history: LiftLog[], exerciseId: string): LastTime | null {
  const sorted = [...history].sort((a, b) => b.date.localeCompare(a.date));
  for (const h of sorted) {
    const w = h.weights?.[exerciseId]?.filter((x): x is number => typeof x === "number" && x > 0);
    if (w && w.length) return { date: h.date, weights: w };
  }
  return null;
}

/** Heaviest weight ever logged for this exercise (0 if never). */
export function bestWeight(history: LiftLog[], exerciseId: string): number {
  let best = 0;
  for (const h of history) for (const x of h.weights?.[exerciseId] ?? []) if (typeof x === "number" && x > best) best = x;
  return best;
}

/** Starting weight for a set: this session's previous set, else last session's same set, else its top set. */
export function suggestWeight(history: LiftLog[], exerciseId: string, set: number, thisSession: (number | null)[] = []): number | null {
  for (let i = set - 2; i >= 0; i--) if (typeof thisSession[i] === "number") return thisSession[i] as number;
  const last = lastTime(history, exerciseId);
  if (!last) return null;
  return last.weights[set - 1] ?? Math.max(...last.weights);
}

/** "95 lb" or "95–105 lb" for a list of set weights. */
export function formatWeights(weights: number[]): string {
  const lo = Math.min(...weights);
  const hi = Math.max(...weights);
  return lo === hi ? `${lo} lb` : `${lo}–${hi} lb`;
}

/** Exercises where this session beat the previous best. */
export function newBests(history: LiftLog[], weights: Record<string, (number | null)[]>): { id: string; weight: number }[] {
  const out: { id: string; weight: number }[] = [];
  for (const [id, sets] of Object.entries(weights)) {
    const top = Math.max(0, ...sets.filter((x): x is number => typeof x === "number"));
    const prev = bestWeight(history, id);
    if (top > 0 && prev > 0 && top > prev) out.push({ id, weight: top });
  }
  return out;
}
