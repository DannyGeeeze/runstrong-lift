/**
 * ============================================================================
 *  WHEN TO LIFT — the RunStrong coach's decision rules.
 * ============================================================================
 *
 *  This file answers ONE question: "what kind of session (if any) today?"
 *  It does not choose exercises (see select.ts) or sets/reps (see sessions.ts).
 *
 *  Order of evaluation (each step records a human-readable rule for "why"):
 *    1. Day type: Race → never a lift (the runner's rule, stricter than the coach's
 *       race-day lifts). Easy → optional upper-body lift (no leg loading), or the
 *       touch-up when an A race is within 7 days; the runner can switch.
 *       Long → optional long-run isos (a few easy holds). Rest → nothing.
 *    2. Race-week role: Thursday race / tune-up, or 1st/2nd hard day before a
 *       non-Thursday race, or a plain workout day.
 *    3. Phase table → base session (Full, Full at half volume, Plyos + Isos, taper).
 *    4. 48h guard: next hard run/race < 48h away → no strength (Plyos + Isos).
 *       Exactly 48h (two calendar days) → allowed with a warning.
 *    5. Weekly caps: max 2 strength + 2 plyo sessions per rolling 7 days. The race week's
 *       lift (Thursday tune-up / 1st hard day before another race) is exempt.
 *    6. Modifiers: Ramp week → Full sessions at lighter loads (2-3 x 8-12 @ RPE 5-6,
 *       low/medium plyos). Short on time → Short session.
 *
 *  Break / return stages (Settings) sit on top of all of this:
 *    - Week off: steps 1-6 don't apply. No hard runs are expected, so any day but a
 *      race day can have one optional ~15-min session of yielding isos, spaced every
 *      2-3 days (rest if the last session was yesterday).
 *    - Ramp week: steps 1-6 apply as normal, then the lighter dosing above.
 *    - Normal: the regular rules.
 *    After 7 days in Week off or Ramp week the app suggests the next stage.
 *
 *  Time is handled at calendar-day granularity: "run first, then lift" means a
 *  lift happens on the afternoon of the run, so a hard day 1 calendar day away
 *  is < 48h, and 2 days away is right at the 48h limit.
 * ============================================================================
 */

import { addDays, dayInWeek, diffDays, mondayOf, weekdayOf } from "../dates";
import type { BreakStage, EasyFocus, LiftLog, UpperFocus, Phase, Race, RunType, SessionType, Settings } from "../types";

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
  settings: Pick<Settings, "tuneUpDay" | "workoutDays" | "deepRaceDay" | "breakStage"> & Partial<Pick<Settings, "breakStageSince">>;
  /** Saved lift sessions, any order. */
  history: LiftLog[];
  shortOnTime?: boolean;
  /** Easy/long days: which optional session the runner picked. Defaults to the touch-up. */
  easyFocus?: EasyFocus;
  /** Upper-body days: the body part the runner picked. Defaults to the one done longest ago. */
  upperFocus?: UpperFocus;
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
  /** Upper-body days: which body part. */
  upperFocus?: UpperFocus;
  /** Ramp week: lighter loads (2-3 x 8-12 @ RPE 5-6) and low/medium plyos only. */
  ramp?: boolean;
}

// ---------------------------------------------------------------------------
// Break / return stages
// ---------------------------------------------------------------------------

export const BREAK_STAGE_LABEL: Record<BreakStage, string> = {
  off: "Week off",
  ramp: "Ramp week",
  normal: "Normal",
};

/** Days in Week off or Ramp week before the app suggests moving on. */
export const BREAK_STAGE_DAYS = 7;
/** Week off: at least this many days between optional sessions (so every 2-3 days). */
export const WEEK_OFF_SPACING = 2;

const NEXT_STAGE: Record<BreakStage, BreakStage | null> = { off: "ramp", ramp: "normal", normal: null };

/** After 7 days in a stage, suggest the next one. The runner decides; nothing changes on its own. */
export function suggestBreakStage(
  settings: Pick<Settings, "breakStage" | "breakStageSince">,
  today: string,
): { next: BreakStage; days: number; message: string } | null {
  const next = NEXT_STAGE[settings.breakStage];
  if (!next || !settings.breakStageSince) return null;
  const days = diffDays(settings.breakStageSince, today);
  if (days < BREAK_STAGE_DAYS) return null;
  const message =
    settings.breakStage === "off"
      ? `${days} days into your week off. Ready for a ramp week of lighter Full sessions?`
      : `${days} days into your ramp week. Ready to go back to normal training?`;
  return { next, days, message };
}

/** Most recent lift before `today` (any session), or null. */
function lastLiftBefore(history: LiftLog[], today: string): string | null {
  let last: string | null = null;
  for (const h of history) if (h.session !== "none" && h.date < today && (!last || h.date > last)) last = h.date;
  return last;
}

/** Week off: hard-day roles, phases, the 48h rule and the caps don't apply. */
function decideWeekOff(ctx: RuleContext, role: Role): Decision {
  const counts = weekCounts(ctx.history, ctx.today);
  const base = {
    half: false,
    plyos: false,
    strength: false,
    role,
    warnings: [] as string[],
    nextHard: null,
    weekCounts: { strength: counts.strength, plyo: counts.plyo },
  };
  if (role === "thu-race" || role === "other-race") {
    const rule = "Week off, race day: no lift";
    return { ...base, session: "none", optional: false, rules: [rule], why: `${rule}.` };
  }
  const last = lastLiftBefore(ctx.history, ctx.today);
  const days = last ? diffDays(last, ctx.today) : null;
  if (days !== null && days < WEEK_OFF_SPACING) {
    const wait = WEEK_OFF_SPACING - days;
    const rule = `Week off: rest today (last session ${days === 1 ? "yesterday" : `${days} days ago`}), next optional session ${wait === 1 ? "tomorrow" : `in ${wait} days`}`;
    return { ...base, session: "none", optional: false, rules: [rule], why: `${rule}.` };
  }
  const since = days === null ? "first one of the break" : `last session ${days} days ago`;
  const rule = `Week off: optional yielding isos, about 15 min (${since})`;
  return { ...base, session: "return", optional: true, rules: [rule], why: `${rule}.` };
}

/** The optional easy-day sessions. Neither counts toward the weekly strength or plyo caps. */
export const EASY_SESSIONS: SessionType[] = ["touch-up", "upper", "long-isos"];

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

export const PHASE_LABEL: Record<Phase, string> = {
  off: "Off-season",
  early: "Early season",
  deep: "Deep season",
  championship: "Championship",
};

/** One line on what each phase means for lifting (Settings and onboarding). */
export const PHASE_HINT: Record<Phase, string> = {
  off: "No races soon: the biggest sessions, with two plyos and an upper-body move.",
  early: "Races starting: full strength sessions around your workouts.",
  deep: "Racing most weeks: lifting fits around meets.",
  championship: "Big races ahead: lighter plyos + isos instead of full strength.",
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
      return "Week off: yielding isos only";
    case "touch-up":
      return "optional 10-min touch-up";
    case "upper":
      return "optional upper body";
    case "long-isos":
      return "optional long-run isos (about 8 min)";
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
const NONE: Base = { session: "none", half: false, optional: false };

/** Off-season has no race-week table in the coach's system; treat race weeks like Early. */
function racePhase(phase: Phase): Exclude<Phase, "off"> {
  return phase === "off" ? "early" : phase;
}

/**
 * The tune-up workout in a Thursday-race week. (The coach also lifts after the race
 * itself; this app never lifts on race days, at the runner's request.)
 */
function thursdayTuneUp(phase: Phase): Base {
  const p = racePhase(phase);
  const table = { early: FULL, deep: FULL, championship: PLYOS_ISOS } as const;
  return table[p];
}

/** The two hard days before a race on another weekday. */
function otherWeek(phase: Phase, role: "other-1st" | "other-2nd"): Base {
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
  switch (role) {
    case "easy":
      // No leg lift on easy days: an upper-body lift by default, or the touch-up
      // in the week before an A race. The runner can switch between the two.
      return { session: ctx.easyFocus ?? defaultEasyFocus(ctx.races, ctx.today), half: false, optional: true };
    case "long":
      // The coach's system says nothing about long-run days. The legs are already
      // tired, so: a few easy holds, optional (recovery suggests boots).
      return { session: "long-isos", half: false, optional: true };
    case "rest":
      return NONE;
    case "thu-race":
    case "other-race":
      // Never lift on race days.
      return NONE;
    case "thu-tuneup":
      return thursdayTuneUp(ctx.phase);
    case "other-1st":
    case "other-2nd":
      return otherWeek(ctx.phase, role);
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

/** Upper-body days rotate through these, in this order when there's a tie. */
export const UPPER_FOCUSES: UpperFocus[] = ["back", "chest", "shoulders"];
export const UPPER_FOCUS_LABEL: Record<UpperFocus, string> = {
  back: "Back & biceps",
  chest: "Chest & triceps",
  shoulders: "Shoulders",
};

/** When each body part was last done before today ("" if never). */
export function lastUpperDays(history: LiftLog[], today: string): Record<UpperFocus, string> {
  const last = { back: "", chest: "", shoulders: "" } as Record<UpperFocus, string>;
  for (const h of history) {
    if (h.session !== "upper" || !h.upperFocus || h.date >= today) continue;
    if (h.date > last[h.upperFocus]) last[h.upperFocus] = h.date;
  }
  return last;
}

/** The body part done longest ago (never done counts as longest), so a week gets to all three. */
export function nextUpperFocus(history: LiftLog[], today: string): UpperFocus {
  const last = lastUpperDays(history, today);
  return [...UPPER_FOCUSES].sort((a, b) => last[a].localeCompare(last[b]))[0];
}

/** Easy days skip the upper-body lift this many days before an A race. */
export const A_RACE_EASY_DAYS = 7;

/** An A race within A_RACE_EASY_DAYS after today, if any. */
export function upcomingARace(races: Race[], today: string): (Race & { inDays: number }) | null {
  const r = races
    .filter((x) => x.priority === "A" && x.date > today && diffDays(today, x.date) <= A_RACE_EASY_DAYS)
    .sort((x, y) => x.date.localeCompare(y.date))[0];
  return r ? { ...r, inDays: diffDays(today, r.date) } : null;
}

/** Easy days are an upper-body lift, except in the week before an A race: then the touch-up. */
export function defaultEasyFocus(races: Race[], today: string): EasyFocus {
  return upcomingARace(races, today) ? "touch-up" : "upper";
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
  if (ctx.settings.breakStage === "off") return decideWeekOff(ctx, role);
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
  const aRace = role === "easy" && !ctx.easyFocus ? upcomingARace(ctx.races, ctx.today) : null;
  if (aRace) rules.push(`${aRace.name} (A) in ${aRace.inDays} day${aRace.inDays === 1 ? "" : "s"}, so no upper-body lift`);

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
  // The race week's lift (the tune-up before a Thursday race, or the 1st hard day before
  // another race) is never cut by the cap: it's the one session the week is built around.
  // The 48h rule above still applies.
  const counts = weekCounts(ctx.history, ctx.today);
  const raceWeekLift = role === "thu-tuneup" || role === "other-1st";
  const overStrength = strength && counts.strength >= 2;
  const overPlyo = plyos && counts.plyo >= 2;
  if (raceWeekLift && (overStrength || overPlyo)) {
    rules.push("race-week lift, so it stays even past the weekly cap");
  } else {
    if (overStrength) {
      strength = false;
      session = "plyos-isos";
      half = false;
      rules.push("already 2 strength sessions in the last 7 days");
    }
    if (overPlyo) {
      plyos = false;
      rules.push("already 2 plyo sessions in the last 7 days");
    }
  }

  // --- Step 6: modifiers -----------------------------------------------------
  if (ctx.shortOnTime && session === "full" && strength) {
    session = "short";
    half = false;
    rules.push("short on time: 20-min session");
  }
  // Ramp week: same timing as normal, lighter dosing (applied when the session is built).
  const ramp = ctx.settings.breakStage === "ramp" && (session === "full" || session === "short");
  if (ramp) rules.push("ramp week: lighter loads, 2-3 x 8-12 @ RPE 5-6, low/medium plyos");

  // Upper body: the body part you've gone longest without, unless you picked one.
  let upperFocus: UpperFocus | undefined;
  if (session === "upper") {
    upperFocus = ctx.upperFocus ?? nextUpperFocus(ctx.history, ctx.today);
    if (!ctx.upperFocus) {
      const last = lastUpperDays(ctx.history, ctx.today)[upperFocus];
      const ago = last ? diffDays(last, ctx.today) : 0;
      rules.push(
        `${UPPER_FOCUS_LABEL[upperFocus].toLowerCase()} is next, ` +
          (last ? `last done ${ago} day${ago === 1 ? "" : "s"} ago` : "not done yet"),
      );
    }
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
    ...(upperFocus ? { upperFocus } : {}),
    ...(ramp ? { ramp } : {}),
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
  // Week off has no hard days, so nothing to make up.
  if (ctx.settings.breakStage === "off") return null;
  // Never lift on race days, not even a make-up for yesterday.
  if (ctx.dayType === "race" || ctx.races.some((r) => r.date === ctx.today)) return null;
  if (ctx.history.some((h) => h.date === yesterday || h.catchUpFor === yesterday)) return null;

  const next = nextHardDay(ctx.today, ctx.races, ctx.settings, ctx.extraHardDays);
  if (next && next.inDays < 2) {
    return { blocked: `Can't make up yesterday's lift: ${next.label} is under 48h away.` };
  }
  const d = decideSession({ ...ctx, today: yesterday, dayType: yesterdayType }, ctx.today);
  if (d.session === "none" || EASY_SESSIONS.includes(d.session)) return null;
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
