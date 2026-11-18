/**
 * ============================================================================
 *  RECOVERY: compression boots and sauna. Stretching is assumed every day.
 * ============================================================================
 *  One suggestion per day (the runner can switch, skip, or log both):
 *    1. Race tomorrow → boots (sauna dehydrates you and can leave you flat).
 *    2. Workout, race or long run today → boots.
 *    3. Yesterday was hard and there were no boots after it → boots (catch-up).
 *    4. Easy day → sauna (heat adaptation, least stress to stack on).
 *    5. Rest day → nothing suggested; either is fine.
 *  Sauna limits: max 3 in 7 days, not two days in a row, none the day before any
 *  race, none in the 2 days before an A or B race. If sauna is off-limits or not
 *  available, an easy day suggests nothing.
 */

import { addDays, diffDays } from "../dates";
import type { Race, RecoveryKind, RecoveryLog, RunType, Settings } from "../types";

export const SAUNA_PER_WEEK = 3;
export const RECOVERY_LABEL: Record<RecoveryKind, string> = { boots: "Compression boots", sauna: "Sauna" };
export const SAUNA_TIP = "10-15 min. Drink water before and after, and get out if you feel dizzy.";

export interface RecoveryInput {
  today: string;
  todayType: RunType;
  yesterdayType: RunType;
  races: Race[];
  recovery: RecoveryLog[];
  settings: Pick<Settings, "hasBoots" | "hasSauna">;
}

export interface RecoverySuggestion {
  /** What to do today, or null for nothing in particular. */
  kind: RecoveryKind | null;
  /** One short sentence. */
  why: string;
  /** Why sauna isn't a good idea today, if it isn't. */
  saunaWarning: string | null;
  /** What's available to pick. */
  options: RecoveryKind[];
}

const HARD: RunType[] = ["workout", "race", "long"];
const HARD_LABEL: Partial<Record<RunType, string>> = { workout: "workout", race: "race", long: "long run" };

/** Why sauna is off-limits today, or null. */
export function saunaBlock(input: Pick<RecoveryInput, "today" | "races" | "recovery">): string | null {
  const { today, races, recovery } = input;
  const soon = races
    .filter((r) => r.date > today)
    .map((r) => ({ ...r, inDays: diffDays(today, r.date) }))
    .filter((r) => r.inDays === 1 || (r.inDays === 2 && r.priority !== "C"))
    .sort((a, b) => a.inDays - b.inDays)[0];
  if (soon) return `${soon.name} is ${soon.inDays === 1 ? "tomorrow" : "in 2 days"}, so no sauna`;
  const saunas = recovery.filter((r) => r.kind === "sauna" && r.date < today);
  if (saunas.some((r) => r.date === addDays(today, -1))) return "sauna yesterday, so not two days in a row";
  const week = saunas.filter((r) => r.date > addDays(today, -7)).length;
  if (week >= SAUNA_PER_WEEK) return `already ${week} saunas in the last 7 days`;
  return null;
}

export function suggestRecovery(input: RecoveryInput): RecoverySuggestion {
  const { today, todayType, yesterdayType, races, recovery, settings } = input;
  const options: RecoveryKind[] = [];
  if (settings.hasBoots) options.push("boots");
  if (settings.hasSauna) options.push("sauna");
  const saunaWarning = settings.hasSauna ? saunaBlock(input) : null;
  const boots = settings.hasBoots;
  const sauna = settings.hasSauna && !saunaWarning;

  const raceTomorrow = races.find((r) => r.date === addDays(today, 1));
  const bootsYesterday = recovery.some((r) => r.kind === "boots" && r.date === addDays(today, -1));

  let kind: RecoveryKind | null = null;
  let why: string;
  if (raceTomorrow && boots) {
    kind = "boots";
    why = `${raceTomorrow.name} is tomorrow: boots to freshen the legs, no sauna.`;
  } else if (HARD.includes(todayType) && boots) {
    kind = "boots";
    why = `After today's ${HARD_LABEL[todayType]}: compression boots.`;
  } else if (HARD.includes(yesterdayType) && !HARD.includes(todayType) && boots && !bootsYesterday) {
    kind = "boots";
    why = `No boots after yesterday's ${HARD_LABEL[yesterdayType]}, so do them today.`;
  } else if (todayType === "easy" && sauna) {
    kind = "sauna";
    why = "Easy day: sauna.";
  } else if (todayType === "rest") {
    why = "Rest day: either one, or neither.";
  } else if (todayType === "easy" && saunaWarning) {
    why = `Easy day: nothing needed (${saunaWarning}).`;
  } else {
    why = "Nothing needed today.";
  }
  return { kind, why, saunaWarning, options };
}
