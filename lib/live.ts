// Live workout: turns a generated workout into a sequence of steps the phone
// walks you through. Each set is a step, rests between sets are timed, timed
// holds count down, and supersets alternate exercises before resting.

import type { Prescription } from "./rules";

export type LiveStep =
  | { kind: "warmup"; lines: string[] }
  | {
      kind: "work";
      item: number;
      set: number;
      sets: number;
      /** For timed holds done one side at a time. */
      side: "left" | "right" | null;
      /** Countdown length for timed work; null means "tap Done when finished". */
      seconds: number | null;
      reps: string;
    }
  | { kind: "rest"; seconds: number; next: number | null; label: string };

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** Work seconds for timed reps ("3-5 s max push", "20-45 s hold", "30 s/side"); null for reps or distance. */
export function workSeconds(reps: string): number | null {
  const m = reps.match(/^(\d+)(?:\s*-\s*(\d+))?\s*s\b/);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  // Short max pushes: use the top of the range. Longer holds: the middle.
  if (hi <= 10) return hi;
  return Math.max(5, Math.floor((lo + hi) / 2 / 5) * 5);
}

/** Rest seconds from text like "2-3 min", "60-90 s", "20 s between reps, 60 s between sets". */
export function restSeconds(rest: string): number {
  const text = rest.toLowerCase();
  if (/straight back|no rest/.test(text)) return 0;
  if (/walk back/.test(text)) return 45;
  const part = text.includes("between sets")
    ? text.split(",").find((p) => p.includes("between sets")) ?? text
    : text.includes("then")
      ? text.split("then")[1]
      : text;
  const m = part.match(/(\d+)(?:\s*-\s*(\d+))?\s*(s|sec|min)/);
  if (!m) return 60;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  const avg = (lo + hi) / 2;
  return round5(m[3] === "min" ? avg * 60 : avg);
}

function isSided(p: Prescription) {
  return /\/side/.test(p.reps);
}

export function buildSteps(items: Prescription[], warmup: string[]): LiveStep[] {
  const steps: LiveStep[] = [];
  if (warmup.length) steps.push({ kind: "warmup", lines: warmup });

  // Group supersets: an item paired with the one right after it.
  const groups: number[][] = [];
  for (let i = 0; i < items.length; i++) {
    const next = items[i + 1];
    if (next && items[i].supersetWith === next.exercise.id && next.supersetWith === items[i].exercise.id) {
      groups.push([i, i + 1]);
      i++;
    } else {
      groups.push([i]);
    }
  }

  groups.forEach((group, g) => {
    const lead = items[group[0]];
    const sets = Math.max(...group.map((i) => items[i].sets));
    for (let set = 1; set <= sets; set++) {
      for (const i of group) {
        const p = items[i];
        if (set > p.sets) continue;
        const seconds = workSeconds(p.reps);
        const reps = p.reps.replace("/side", "");
        if (seconds !== null && isSided(p)) {
          steps.push({ kind: "work", item: i, set, sets: p.sets, side: "left", seconds, reps });
          steps.push({ kind: "rest", seconds: 5, next: i, label: "Switch sides" });
          steps.push({ kind: "work", item: i, set, sets: p.sets, side: "right", seconds, reps });
        } else {
          steps.push({ kind: "work", item: i, set, sets: p.sets, side: null, seconds, reps: p.reps });
        }
      }
      const lastSetOfGroup = set === sets;
      const lastGroup = g === groups.length - 1;
      if (lastSetOfGroup && lastGroup) continue;
      const nextItem = lastSetOfGroup ? groups[g + 1][0] : group[0];
      const seconds = Math.max(restSeconds(lead.rest), lastSetOfGroup ? 45 : 0);
      if (seconds > 0) steps.push({ kind: "rest", seconds, next: nextItem, label: lastSetOfGroup ? "Next exercise" : "Rest" });
    }
  });
  return steps;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
