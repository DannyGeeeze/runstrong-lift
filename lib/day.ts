// What kind of day is a given date? Override > race schedule > Strava runs > rest.

import { hardestType } from "./strava";
import type { Race, Run, RunType } from "./types";

export type DaySource = "override" | "race-schedule" | "strava" | "none";

export function dayType(
  date: string,
  runs: Run[],
  overrides: Record<string, RunType>,
  races: Race[],
): { type: RunType; source: DaySource; runs: Run[] } {
  const dayRuns = runs.filter((r) => r.date === date).sort((a, b) => a.startLocal.localeCompare(b.startLocal));
  if (overrides[date]) return { type: overrides[date], source: "override", runs: dayRuns };
  if (races.some((r) => r.date === date)) return { type: "race", source: "race-schedule", runs: dayRuns };
  if (dayRuns.length) return { type: hardestType(dayRuns.map((r) => r.type)), source: "strava", runs: dayRuns };
  return { type: "rest", source: "none", runs: dayRuns };
}

/** Future dates the user marked as Workout/Race count as hard days for the 48h rule. */
export function futureHardOverrides(today: string, overrides: Record<string, RunType>): string[] {
  return Object.entries(overrides)
    .filter(([d, t]) => d > today && (t === "workout" || t === "race"))
    .map(([d]) => d);
}

export const RUN_TYPE_LABEL: Record<RunType, string> = {
  easy: "Easy",
  long: "Long",
  workout: "Workout",
  race: "Race",
  rest: "Rest",
};
