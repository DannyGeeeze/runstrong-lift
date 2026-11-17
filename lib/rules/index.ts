// Rules engine entry point: decide the session, fill it with exercises, dose it.

import { isPlyo, isoKind } from "../exercises";
import type { Profile } from "../profile";
import type { BlockPicks, LiftLog, Settings } from "../types";
import { decideSession, weekCounts, type Decision, type RuleContext } from "./rules";
import { currentBlock } from "./select";
import {
  buildItems,
  estimateMinutes,
  FULL_MAX_MINUTES,
  warmupFor,
  type Prescription,
} from "./sessions";

export * from "./rules";
export * from "./select";
export * from "./sessions";

export interface Workout {
  date: string;
  attempt: number;
  decision: Decision;
  title: string;
  warmup: string[];
  items: Prescription[];
  estMinutes: number;
  catchUpFor?: string;
}

export interface GenerateInput extends RuleContext {
  settings: RuleContext["settings"] & Pick<Settings, "enablePower" | "enableMobility">;
  block: BlockPicks | null;
  /** Onboarding answers. Optional: without it, nothing is filtered. */
  profile?: Profile | null;
  /** 0 = first generate; Regenerate increments it. */
  attempt?: number;
  /** Use a precomputed decision (e.g. a catch-up) instead of deciding from ctx. */
  decision?: Decision & { catchUpFor?: string };
}

const TITLES: Record<Decision["session"], string> = {
  full: "Full strength",
  short: "Short strength (20 min)",
  "plyos-isos": "Plyos + Isos",
  taper: "Race-day isos",
  return: "Return week isos",
  "touch-up": "10-min touch-up",
  upper: "Upper body",
  none: "No lift today",
};

export function generateWorkout(input: GenerateInput): Workout {
  const attempt = input.attempt ?? 0;
  const decision = input.decision ?? decideSession(input);
  const block = currentBlock(input.block, input.today);
  const { plyoTypes } = weekCounts(input.history, input.today);

  let items = buildItems(decision, {
    date: input.decision?.catchUpFor ?? input.today,
    phase: input.phase,
    attempt,
    block,
    enablePower: input.settings.enablePower,
    enableMobility: input.settings.enableMobility,
    plyoTypesThisWeek: plyoTypes,
    profile: input.profile,
  });

  // Full sessions are ~45 min max: trim a set from the accessory slots until it fits.
  if (decision.session === "full") {
    const trimOrder = ["D2", "D1", "C2", "C1", "A2"];
    for (const slot of trimOrder) {
      if (estimateMinutes(decision, items) <= FULL_MAX_MINUTES) break;
      items = items.map((p) => (p.slot === slot && p.sets > 2 ? { ...p, sets: p.sets - 1 } : p));
    }
  }

  let title = TITLES[decision.session];
  if (decision.session === "full" && decision.half) title = "Full strength, half volume";
  if (decision.session === "plyos-isos" && !decision.plyos) title = "Isos only";

  return {
    date: input.today,
    attempt,
    decision,
    title,
    warmup: warmupFor(decision),
    items,
    estMinutes: decision.session === "none" ? 0 : estimateMinutes(decision, items),
    catchUpFor: input.decision?.catchUpFor,
  };
}

/** Turn a completed workout into a history entry. */
export function toLiftLog(w: Workout, id: string, doneIds?: string[], weights?: LiftLog["weights"]): LiftLog {
  const items = doneIds ? w.items.filter((i) => doneIds.includes(i.exercise.id)) : w.items;
  const strengthItems = items.filter((i) => !isPlyo(i.exercise) && !isoKind(i.exercise));
  const plyoItems = items.filter((i) => isPlyo(i.exercise));
  return {
    id,
    date: w.date,
    session: w.decision.session,
    volume: w.decision.half ? "half" : "full",
    exerciseIds: items.map((i) => i.exercise.id),
    hadStrength: (w.decision.session === "full" || w.decision.session === "short") && strengthItems.length > 0,
    hadPlyo: plyoItems.length > 0,
    plyoTypes: [...new Set(plyoItems.map((i) => i.exercise.plyo_type).filter((t): t is string => !!t))],
    catchUpFor: w.catchUpFor,
    ...(weights && Object.keys(weights).length ? { weights } : {}),
  };
}
