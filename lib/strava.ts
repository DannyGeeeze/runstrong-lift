// Strava activity → Run mapping. Shared by the API route and the client.

import type { Run, RunType } from "./types";

/** The subset of a Strava SummaryActivity we use. */
export interface StravaActivity {
  id: number;
  name: string;
  type?: string;
  sport_type?: string;
  start_date_local: string;
  distance: number;
  moving_time: number;
  average_heartrate?: number;
  workout_type?: number | null;
}

const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);

export function isRun(a: StravaActivity): boolean {
  return RUN_TYPES.has(a.sport_type ?? a.type ?? "");
}

/** Strava run workout_type: 0 default, 1 race, 2 long run, 3 workout. */
export function typeFromStrava(workoutType: number | null | undefined): RunType {
  switch (workoutType) {
    case 1:
      return "race";
    case 2:
      return "long";
    case 3:
      return "workout";
    default:
      return "easy";
  }
}

export const STRAVA_TYPE_LABEL: Record<number, string> = {
  0: "default",
  1: "race",
  2: "long run",
  3: "workout",
};

export function toRun(a: StravaActivity): Run {
  return {
    id: String(a.id),
    // start_date_local is local wall time with a misleading "Z"; the date part is the local day.
    date: a.start_date_local.slice(0, 10),
    startLocal: a.start_date_local,
    name: a.name,
    distanceM: a.distance,
    movingTimeS: a.moving_time,
    avgHr: a.average_heartrate ? Math.round(a.average_heartrate) : undefined,
    stravaWorkoutType: a.workout_type ?? 0,
    type: typeFromStrava(a.workout_type),
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const METERS_PER_MILE = 1609.344;

export function miles(m: number): string {
  return (m / METERS_PER_MILE).toFixed(1);
}

export function duration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.round(s % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${m}:${String(sec).padStart(2, "0")}`;
}

export function pacePerMile(distanceM: number, movingTimeS: number): string {
  if (distanceM <= 0) return "–";
  const s = movingTimeS / (distanceM / METERS_PER_MILE);
  return `${duration(s)}/mi`;
}

const HARDNESS: RunType[] = ["rest", "easy", "long", "workout", "race"];

/** On a day with two runs, the hardest one sets the day's type. */
export function hardestType(types: RunType[]): RunType {
  return types.reduce<RunType>((a, b) => (HARDNESS.indexOf(b) > HARDNESS.indexOf(a) ? b : a), "rest");
}
