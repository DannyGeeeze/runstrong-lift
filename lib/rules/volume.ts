// Session size follows weekly mileage, and only grows with it: at lower mileage Full
// sessions are smaller; from FULL_FROM miles a week they're the coach's full dosing, and
// nothing is cut at peak mileage. Lifting and mileage build together.

export type VolumeTier = "base" | "build" | "full";

/** Miles per week where each tier starts. */
export const VOLUME_MILES = { build: 20, full: 35 } as const;

export function volumeTier(miles: number): VolumeTier {
  if (miles >= VOLUME_MILES.full) return "full";
  if (miles >= VOLUME_MILES.build) return "build";
  return "base";
}

export interface WeeklyMiles {
  miles: number;
  /** "runs": the last 7 days of logged runs; "profile": the setup answer. */
  source: "runs" | "profile";
}

/** Use the last 7 days of runs when there are any; otherwise the setup answer; otherwise unknown. */
export function weeklyMilesFor(last7Miles: number, runCount: number, profileMiles?: number): WeeklyMiles | null {
  if (runCount > 0) return { miles: last7Miles, source: "runs" };
  if (profileMiles !== undefined) return { miles: profileMiles, source: "profile" };
  return null;
}

export const VOLUME_NOTE: Record<Exclude<VolumeTier, "full">, (miles: number) => string> = {
  base: (m) => `Lighter volume at ~${Math.round(m)} mi/week: 2 sets each. Sessions grow as your mileage builds (full from ${VOLUME_MILES.full}).`,
  build: (m) => `Building volume at ~${Math.round(m)} mi/week: main lift 3 sets, the rest 2. Full sessions from ${VOLUME_MILES.full} mi/week.`,
};
