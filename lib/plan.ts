// The week ahead, as the rules see it: what run each day probably is and which lift
// that gives. Used by the desktop planning view. Nothing here is saved.

import { addDays, diffDays, mondayOf } from "./dates";
import { generateWorkout, hardDays, suggestPhase, toLiftLog, type GenerateInput, type Workout } from "./rules";
import type { BreakStage, Phase, RunType, Settings } from "./types";

/** Where a day's run type came from. */
export type PlanSource = "today" | "override" | "race" | "planned" | "assumed";

export interface PlanDay {
  date: string;
  type: RunType;
  source: PlanSource;
  /** For planned hard days: "tune-up workout", "workout", ... */
  label?: string;
  workout: Workout;
  /** Phase used for this day (your setting this week; later weeks may follow the suggestion). */
  phase: Phase;
  /** True when `phase` is the app's suggestion rather than your setting. */
  phaseSuggested: boolean;
  /** Break / return stage on this day, played forward (Week off → Ramp week → Normal, 7 days each). */
  stage: BreakStage;
}

export interface PlanOptions {
  /** Weeks after this one use the phase the app suggests for that week (season view). */
  followSuggestedPhase?: boolean;
}

/** The break stage on a future date, assuming you move on after 7 days in each stage. */
export function stageOn(settings: Pick<Settings, "breakStage" | "breakStageSince">, date: string): BreakStage {
  const { breakStage, breakStageSince } = settings;
  if (breakStage === "normal" || !breakStageSince) return breakStage;
  const d = diffDays(breakStageSince, date);
  if (breakStage === "off") return d < 7 ? "off" : d < 14 ? "ramp" : "normal";
  return d < 7 ? "ramp" : "normal";
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
  opts: PlanOptions = {},
): PlanDay[] {
  const weeks = Math.ceil(days / 7) + 1;
  const hard = new Map(hardDays(input.today, input.races, input.settings, input.extraHardDays, weeks).map((h) => [h.date, h.label]));
  const thisMonday = mondayOf(input.today);
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

    // This week: your phase. Later weeks (season view): the phase the app suggests for that week.
    const later = mondayOf(date) > thisMonday;
    const phaseSuggested = !!opts.followSuggestedPhase && later;
    const phase = phaseSuggested ? suggestPhase(input.races, mondayOf(date)).phase : input.phase;
    const stage = stageOn({ breakStage: input.settings.breakStage, breakStageSince: input.settings.breakStageSince ?? "" }, date);
    const settings = { ...input.settings, breakStage: stage };

    // Today's picks (easy-day choice, body part, short on time) only apply to today.
    const day: GenerateInput =
      i === 0
        ? { ...input, phase, settings, history }
        : { ...input, today: date, dayType: type, phase, settings, history, easyFocus: undefined, upperFocus: undefined };
    const workout = generateWorkout(day);
    out.push({ date, type, source, label, workout, phase, phaseSuggested, stage });

    // Assume each planned lift gets done (unless one is already logged that day).
    if (workout.decision.session !== "none" && !history.some((h) => h.date === date)) {
      history = [...history, toLiftLog(workout, `plan-${date}`)];
    }
  }
  return out;
}
