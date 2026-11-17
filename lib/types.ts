// Shared types for RunStrong Lift.

export type RunType = "easy" | "long" | "workout" | "race" | "rest";
export type Phase = "off" | "early" | "deep" | "championship";
export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

/** Session types match the `session_types` tags in data/runstrong_exercises.json. */
export type SessionType =
  | "full"
  | "short"
  | "plyos-isos"
  | "taper"
  | "return"
  | "touch-up"
  | "upper"
  | "none";

/** What to do on an easy or long-run day. The touch-up is the default. */
export type EasyFocus = "touch-up" | "upper";

export type Slot =
  | "A1"
  | "A2"
  | "B1"
  | "POWER"
  | "C1"
  | "C2"
  | "D1"
  | "D2"
  | "ISO"
  | "MOBILITY"
  | "UPPER";

export type Intensity = "low" | "med" | "high";
export type IsoKind = "overcoming" | "yielding" | "hold";

/** One entry in the exercise bank. Only id/name/slot/session_types are strictly required. */
export interface Exercise {
  id: string;
  name: string;
  slot: Slot;
  session_types: string[];
  intensity?: Intensity;
  unilateral?: boolean;
  sets?: number;
  reps?: string;
  rest?: string;
  cue?: string;
  video_url?: string;
  equipment?: string;
  isometric?: string | null;
  tier?: string | null;
  plyo_type?: string | null;
  category?: string;
  library_category?: string;
  phases?: string[];
  featured?: boolean;
  source?: string;
}

export interface Run {
  id: string;
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  startLocal: string;
  name: string;
  distanceM: number;
  movingTimeS: number;
  avgHr?: number;
  /** Strava workout_type: 0 default, 1 race, 2 long run, 3 workout. */
  stravaWorkoutType?: number | null;
  type: RunType;
}

export type RacePriority = "A" | "B" | "C";

export interface Race {
  id: string;
  date: string;
  name: string;
  distance: string;
  priority: RacePriority;
}

export interface Settings {
  phase: Phase;
  /** Day of the single tune-up workout before a Thursday race. */
  tuneUpDay: "mon" | "tue";
  /** Workout days used for weeks with no race (for the 48h rule). */
  workoutDays: Weekday[];
  /** Deep season Thursday race day: "Full at half volume" or "Plyos + Isos". */
  deepRaceDay: "half" | "plyos-isos";
  returnWeek: boolean;
  enablePower: boolean;
  enableMobility: boolean;
  mockMode: boolean;
}

export interface LiftLog {
  id: string;
  date: string;
  session: SessionType;
  volume: "full" | "half";
  exerciseIds: string[];
  hadStrength: boolean;
  hadPlyo: boolean;
  plyoTypes: string[];
  /** Set when this was a next-morning catch-up for the previous day's workout. */
  catchUpFor?: string;
  /** Weights lifted (lb), per exercise id, one entry per set (null = set done without a weight). */
  weights?: Record<string, (number | null)[]>;
}

/** Block picks per "session:slot" key, kept for 3–4 weeks before rotating. */
export interface BlockPicks {
  startedOn: string;
  picks: Record<string, string[]>;
}
