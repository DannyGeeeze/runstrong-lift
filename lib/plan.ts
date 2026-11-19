// The week ahead, as the rules see it: what run each day probably is and which lift
// that gives. Used by the desktop planning view. Nothing here is saved.

import { addDays } from "./dates";
import { generateWorkout, hardDays, toLiftLog, type GenerateInput, type Workout } from "./rules";
import type { RunType } from "./types";

/** Where a day's run type came from. */
export type PlanSource = "today" | "override" | "race" | "planned" | "assumed";

export interface PlanDay {
  date: string;
  type: RunType;
  source: PlanSource;
  /** For planned hard days: "tune-up workout", "workout", ... */
  label?: string;
  workout: Workout;
}

export const PLAN_SOURCE_LABEL: Record<PlanSource, string> = {
  today: "Today",
  override: "Set by you",
  race: "Race on your schedule",
  planned: "Workout day from Settings",
  assumed: "Assumed easy",
};

/**
 * Plan `days` days starting today.
 *
 * Today uses today's real run type and the inputs as given (easy-day pick, short on time...).
 * Later days: your run-type override > a race on the schedule > a planned hard day
 * (Settings workout days / race-week tune-ups) > easy. Each planned lift is added to the
 * history before the next day is planned, so weekly caps, the upper-body rotation and the
 * week-off spacing play out the way they would if you did each one.
 */
export function planDays(
  input: Omit<GenerateInput, "attempt" | "decision">,
  overrides: Record<string, RunType>,
  days = 7,
): PlanDay[] {
  const hard = new Map(hardDays(input.today, input.races, input.settings, input.extraHardDays).map((h) => [h.date, h.label]));
  let history = [...input.history];
  const out: PlanDay[] = [];

  for (let i = 0; i < days; i++) {
    const date = addDays(input.today, i);
    let type: RunType;
    let source: PlanSource;
    let label: string | undefined;
    if (i === 0) {
      type = input.dayType;
      source = "today";
    } else if (overrides[date]) {
      type = overrides[date];
      source = "override";
    } else if (input.races.some((r) => r.date === date)) {
      type = "race";
      source = "race";
    } else if (hard.has(date)) {
      type = "workout";
      source = "planned";
      label = hard.get(date);
    } else {
      type = "easy";
      source = "assumed";
    }

    // Today's picks (easy-day choice, body part, short on time) only apply to today.
    const day: GenerateInput =
      i === 0
        ? { ...input, history }
        : { ...input, today: date, dayType: type, history, easyFocus: undefined, upperFocus: undefined };
    const workout = generateWorkout(day);
    out.push({ date, type, source, label, workout });

    // Assume each planned lift gets done (unless one is already logged that day).
    if (workout.decision.session !== "none" && !history.some((h) => h.date === date)) {
      history = [...history, toLiftLog(workout, `plan-${date}`)];
    }
  }
  return out;
}
