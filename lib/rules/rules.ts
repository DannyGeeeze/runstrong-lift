/**
 * ============================================================================
 *  WHEN TO LIFT — the RunStrong coach's decision rules.
 * ============================================================================
 *
 *  This file answers ONE question: "what kind of session (if any) today?"
 *  It does not choose exercises (see select.ts) or sets/reps (see sessions.ts).
 *
 *  Order of evaluation (each step records a human-readable rule for "why"):
 *    1. Day type: Easy/Long → optional touch-up only. Rest → nothing.
 *    2. Race-week role: Thursday race / tune-up, or 1st/2nd hard day before a
 *       non-Thursday race, or a plain workout day.
 *    3. Phase table → base session (Full, Full at half volume, Plyos + Isos, taper).
 *    4. 48h guard: next hard run/race < 48h away → no strength (Plyos + Isos).
 *       Exactly 48h (two calendar days) → allowed with a warning.
 *    5. Weekly caps: max 2 strength + 2 plyo sessions per rolling 7 days.
 *    6. Modifiers: Return week → yielding isos only. Short on time → Short session.
 *
 *  Time is handled at calendar-day granularity: "run first, then lift" means a
 *  lift happens on the afternoon of the run, so a hard day 1 calendar day away
 *  is < 48h, and 2 days away is right at the 48h limit.
 * ============================================================================
 */

import { addDays, dayInWeek, diffDays, mondayOf, weekdayOf } from "../dates";
import type { LiftLog, Phase, Race, RunType, SessionType, Settings } from "../types";

export type Role =
  | "thu-race" // Thursday race day
  | "thu-tuneup" // the one workout earlier in a Thursday-race week
  | "other-race" // race on any other weekday
  | "other-1st" // 1st of the two hard days before a non-Thursday race
  | "other-2nd" // 2nd (last) hard day before a non-Thursday race
  | "workout" // a workout with no race close by
  | "easy"
  | "long"
  | "rest";

export interface RuleContext {
  /** The day being planned (YYYY-MM-DD). */
  today: string;
  /** Today's run type (from Strava or the user's override). */
  dayType: RunType;
  phase: Phase;
  races: Race[];
  settings: Pick<Settings, "tuneUpDay" | "workoutDays" | "deepRaceDay" | "returnWeek">;
  /** Saved lift sessions, any order. */
  history: LiftLog[];
  shortOnTime?: boolean;
  /** Extra known hard days (e.g. future dates the user marked as Workout/Race). */
  extraHardDays?: string[];
}

export interface HardDay {
  date: string;
  label: string;
}

export interface Decision {
  session: SessionType;
  /** Full at half volume. */
  half: boolean;
  /** Include plyos in this session. */
  plyos: boolean;
  /** Include strength (loaded) moves in this session. */
  strength: boolean;
  /** The app offers it but it's fine to skip (touch-up, championship race-day isos). */
  optional: boolean;
  role: Role;
  /** Rules applied, in order. The first is the base rule. */
  rules: string[];
  /** One sentence: "Deep season, race day: Plyos + Isos." */
  why: string;
  warnings: string[];
  nextHard: (HardDay & { inDays: number }) | null;
  /** Strength / plyo sessions in the last 7 days (before today's). */
  weekCounts: { strength: number; plyo: number };
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const PHASE_LABEL: Record<Phase, string> = {
  off: "Off-season",
  early: "Early season",
  deep: "Deep season",
  championship: "Championship",
};

const ROLE_LABEL: Record<Role, string> = {
  "thu-race": "Thursday race day",
  "thu-tuneup": "tune-up workout before Thursday's race",
  "other-race": "race day",
  "other-1st": "1st hard day before the race",
  "other-2nd": "2nd hard day before the race",
  workout: "workout day",
  easy: "easy day",
  long: "long run day",
  rest: "rest day",
};

export function sessionLabel(d: Pick<Decision, "session" | "half" | "plyos" | "strength">): string {
  switch (d.session) {
    case "full":
      if (!d.plyos) return d.half ? "Full at half volume, no plyos" : "Full, no plyos";
      return d.half ? "Full at half volume" : "Full";
    case "short":
      return d.plyos ? "Short (20 min)" : "Short (20 min), no plyos";
    case "plyos-isos":
      return d.plyos ? "Plyos + Isos" : "Isos only";
    case "taper":
      return "a few isos (optional)";
    case "return":
      return "Return week: yielding isos only";
    case "touch-up":
      return "optional 10-min touch-up";
    case "none":
      return "no lift";
  }
}

// ---------------------------------------------------------------------------
// Hard-day calendar (used for roles and the 48h rule)
// ---------------------------------------------------------------------------

/**
 * Known hard days around a date:
 *  - every race;
 *  - Thursday race week: the tune-up day (Mon or Tue, a setting);
 *  - other race weeks: two hard days before the race, assumed at race-4 and race-2
 *    (race-2 is the closest a lift-friendly workout can sit: exactly 48h out);
 *  - weeks with no race: the regular workout days from settings;
 *  - plus any extra hard days passed in.
 */
export function hardDays(
  from: string,
  races: Race[],
  settings: Pick<Settings, "tuneUpDay" | "workoutDays">,
  extra: string[] = [],
  weeks = 3,
): HardDay[] {
  const out = new Map<string, string>();
  const start = mondayOf(addDays(from, -7));
  for (let w = 0; w < weeks + 1; w++) {
    const monday = addDays(start, w * 7);
    const sunday = addDays(monday, 6);
    const weekRaces = races.filter((r) => r.date >= monday && r.date <= sunday);
    if (weekRaces.length === 0) {
      for (const d of settings.workoutDays) out.set(dayInWeek(monday, d), "workout");
    }
    for (const r of weekRaces) {
      if (weekdayOf(r.date) === "thu") {
        const tune = dayInWeek(r.date, settings.tuneUpDay);
        if (!out.has(tune)) out.set(tune, "tune-up workout");
      } else {
        for (const [off, label] of [
          [-4, "1st workout before race"],
          [-2, "2nd workout before race"],
        ] as const) {
          const d = addDays(r.date, off);
          if (!out.has(d)) out.set(d, label);
        }
      }
    }
  }
  // Races always win the label.
  for (const r of races) out.set(r.date, `race: ${r.name}`);
  for (const d of extra) if (!out.has(d)) out.set(d, "hard day");
  return [...out.entries()]
    .map(([date, label]) => ({ date, label }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function nextHardDay(
  after: string,
  races: Race[],
  settings: Pick<Settings, "tuneUpDay" | "workoutDays">,
  extra: string[] = [],
  ignore: (h: HardDay) => boolean = () => false,
): (HardDay & { inDays: number }) | null {
  const next = hardDays(after, races, settings, extra).find((h) => h.date > after && !ignore(h));
  return next ? { ...next, inDays: diffDays(after, next.date) } : null;
}

// ---------------------------------------------------------------------------
// Step 2: role of the day
// ---------------------------------------------------------------------------

export function roleFor(ctx: RuleContext): Role {
  const { today, dayType, races } = ctx;
  const raceToday = races.find((r) => r.date === today);
  if (raceToday || dayType === "race") {
    return weekdayOf(today) === "thu" ? "thu-race" : "other-race";
  }
  if (dayType !== "workout") return dayType;

  // Workout day: is a race coming within the next 6 days?
  const upcoming = races
    .filter((r) => r.date > today && diffDays(today, r.date) <= 6)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!upcoming) return "workout";

  if (weekdayOf(upcoming.date) === "thu" && mondayOf(upcoming.date) === mondayOf(today)) {
    return "thu-tuneup";
  }
  if (weekdayOf(upcoming.date) !== "thu") {
    // 1st vs 2nd: is there another planned hard day between today and the race?
    const between = hardDays(today, races, ctx.settings, ctx.extraHardDays).some(
      (h) => h.date > today && h.date < upcoming.date,
    );
    return between ? "other-1st" : "other-2nd";
  }
  return "workout";
}

// ---------------------------------------------------------------------------
// Step 3: phase tables
// ---------------------------------------------------------------------------

type Base = Pick<Decision, "session" | "half" | "optional">;
const FULL: Base = { session: "full", half: false, optional: false };
const HALF: Base = { session: "full", half: true, optional: false };
const PLYOS_ISOS: Base = { session: "plyos-isos", half: false, optional: false };
const FEW_ISOS: Base = { session: "taper", half: false, optional: true };

/** Off-season has no race-week table in the coach's system; treat race weeks like Early. */
function racePhase(phase: Phase): Exclude<Phase, "off"> {
  return phase === "off" ? "early" : phase;
}

/** My Thursday-race week (the default week). */
function thursdayWeek(phase: Phase, role: "thu-race" | "thu-tuneup", deepRaceDay: "half" | "plyos-isos"): Base {
  const p = racePhase(phase);
  const table = {
    //              workout (tune-up) day     race day (lift after the race)
    early: { "thu-tuneup": FULL, "thu-race": FULL },
    deep: { "thu-tuneup": FULL, "thu-race": deepRaceDay === "half" ? HALF : PLYOS_ISOS },
    championship: { "thu-tuneup": PLYOS_ISOS, "thu-race": FEW_ISOS },
  } as const;
  return table[p][role];
}

/** Races on other days. Race day itself uses the same row as a Thursday race day. */
function otherWeek(phase: Phase, role: "other-1st" | "other-2nd" | "other-race", deepRaceDay: "half" | "plyos-isos"): Base {
  if (role === "other-race") return thursdayWeek(phase, "thu-race", deepRaceDay);
  const p = racePhase(phase);
  const table = {
    //              1st hard day   2nd hard day
    early: { "other-1st": FULL, "other-2nd": HALF },
    deep: { "other-1st": FULL, "other-2nd": PLYOS_ISOS },
    championship: { "other-1st": PLYOS_ISOS, "other-2nd": PLYOS_ISOS },
  } as const;
  return table[p][role];
}

function baseFor(role: Role, ctx: RuleContext): Base {
  const deep = ctx.settings.deepRaceDay;
  switch (role) {
    case "easy":
    case "long":
      // No main lift on easy/long days; offer an optional touch-up.
      return { session: "touch-up", half: false, optional: true };
    case "rest":
      return { session: "none", half: false, optional: false };
    case "thu-race":
    case "thu-tuneup":
      return thursdayWeek(ctx.phase, role, deep);
    case "other-race":
    case "other-1st":
    case "other-2nd":
      return otherWeek(ctx.phase, role, deep);
    case "workout":
      // Workout with no race close by: Full, except Championship keeps it to Plyos + Isos.
      return ctx.phase === "championship" ? PLYOS_ISOS : FULL;
  }
}

// ---------------------------------------------------------------------------
// Step 5 helper: rolling 7-day counts
// ---------------------------------------------------------------------------

export function weekCounts(history: LiftLog[], today: string) {
  const from = addDays(today, -6);
  const recent = history.filter((h) => h.date >= from && h.date <= today);
  return {
    strength: recent.filter((h) => h.hadStrength).length,
    plyo: recent.filter((h) => h.hadPlyo).length,
    plyoTypes: [...new Set(recent.flatMap((h) => h.plyoTypes))],
  };
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

function hasStrength(session: SessionType) {
  return session === "full" || session === "short";
}
function hasPlyos(session: SessionType) {
  return session === "full" || session === "short" || session === "plyos-isos";
}

/**
 * Decide today's session.
 * @param guardFrom date the 48h rule is measured from (defaults to ctx.today). The
 *   next-morning catch-up plans yesterday's session but measures 48h from today.
 */
export function decideSession(ctx: RuleContext, guardFrom: string = ctx.today): Decision {
  const role = roleFor(ctx);
  const base = baseFor(role, ctx);
  const phaseLabel = PHASE_LABEL[ctx.phase];
  const roleLabel = ROLE_LABEL[role];

  let session = base.session;
  let half = base.half;
  let optional = base.optional;
  let strength = hasStrength(session);
  let plyos = hasPlyos(session);
  const rules: string[] = [];
  const warnings: string[] = [];

  rules.push(`${phaseLabel}, ${roleLabel}: ${sessionLabel({ session, half, plyos, strength })}`);

  // --- Step 4: 48h guard -----------------------------------------------------
  // If today is the race-week tune-up, the planned tune-up day later this week isn't
  // another hard day: the workout just happened today instead.
  const nextHard = nextHardDay(guardFrom, ctx.races, ctx.settings, ctx.extraHardDays, (h) =>
    role === "thu-tuneup" && h.label === "tune-up workout" && mondayOf(h.date) === mondayOf(ctx.today),
  );
  if (strength && nextHard && nextHard.inDays < 2) {
    session = "plyos-isos";
    half = false;
    strength = false;
    plyos = true;
    rules.push(`next hard day (${nextHard.label}) is under 48h away, so no strength`);
  } else if (strength && nextHard && nextHard.inDays === 2) {
    if (role === "thu-tuneup" && weekdayOf(ctx.today) === "tue") {
      warnings.push(
        "Tuesday lift is right at the 48h limit before Thursday's race. Lift straight after the run and keep it crisp.",
      );
    } else {
      warnings.push(`This lift is right at the 48h limit before the next hard day (${nextHard.label}).`);
    }
  }

  // --- Step 5: weekly caps (2 strength + 2 plyo per rolling 7 days) ----------
  const counts = weekCounts(ctx.history, ctx.today);
  if (strength && counts.strength >= 2) {
    strength = false;
    session = "plyos-isos";
    half = false;
    rules.push("already 2 strength sessions in the last 7 days");
  }
  if (plyos && counts.plyo >= 2) {
    plyos = false;
    rules.push("already 2 plyo sessions in the last 7 days");
  }

  // --- Step 6: modifiers -----------------------------------------------------
  if (ctx.settings.returnWeek && session !== "none") {
    session = "return";
    strength = false;
    plyos = false;
    half = false;
    rules.push("return week: yielding isos only");
  } else if (ctx.shortOnTime && session === "full" && strength) {
    session = "short";
    half = false;
    rules.push("short on time: 20-min session");
  }

  const final = sessionLabel({ session, half, plyos, strength });
  const [first, ...rest] = rules;
  const why =
    rest.length === 0
      ? `${first}.`
      : `${first.split(":")[0]}: ${final} (${rest.join("; ")}).`;

  return {
    session,
    half,
    plyos,
    strength,
    optional,
    role,
    rules,
    why,
    warnings,
    nextHard,
    weekCounts: { strength: counts.strength, plyo: counts.plyo },
  };
}

/**
 * Next-morning catch-up: if yesterday was a workout/race day with no lift logged,
 * allow yesterday's lift this morning — but only if the next hard run is 48h+ away
 * from this morning. Returns null when not allowed.
 */
export function decideCatchUp(
  ctx: RuleContext,
  yesterdayType: RunType | undefined,
): (Decision & { catchUpFor: string }) | { blocked: string } | null {
  const yesterday = addDays(ctx.today, -1);
  if (yesterdayType !== "workout" && yesterdayType !== "race") return null;
  if (ctx.history.some((h) => h.date === yesterday || h.catchUpFor === yesterday)) return null;

  const next = nextHardDay(ctx.today, ctx.races, ctx.settings, ctx.extraHardDays);
  if (next && next.inDays < 2) {
    return { blocked: `Can't make up yesterday's lift: ${next.label} is under 48h away.` };
  }
  const d = decideSession({ ...ctx, today: yesterday, dayType: yesterdayType }, ctx.today);
  if (d.session === "none" || d.session === "touch-up") return null;
  return {
    ...d,
    catchUpFor: yesterday,
    why: `Catch-up this morning for yesterday. ${d.why}`,
  };
}

// ---------------------------------------------------------------------------
// Phase suggestion (the user still picks)
// ---------------------------------------------------------------------------

export function suggestPhase(races: Race[], today: string): { phase: Phase; reason: string } {
  const future = races.filter((r) => r.date >= today);
  const within = (days: number, pri?: string) =>
    future.filter((r) => diffDays(today, r.date) <= days && (!pri || r.priority === pri));
  const recentPast = races.filter((r) => r.date < today && diffDays(r.date, today) <= 42);

  if (within(21, "A").length > 0) {
    return { phase: "championship", reason: "An A-priority race is within 3 weeks." };
  }
  if (within(21).length > 0 && recentPast.length > 0) {
    return { phase: "deep", reason: "You're mid-season: races in the last 6 weeks and the next 3." };
  }
  if (within(70).length > 0) {
    return { phase: "early", reason: "Your next race is coming up but the season is just starting." };
  }
  return { phase: "off", reason: "No races in the next 10 weeks." };
}
