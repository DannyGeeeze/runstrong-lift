/**
 * ============================================================================
 *  SESSION TEMPLATES + DOSING — what goes into each session type.
 * ============================================================================
 *  Plyos, every session that has them: the coach's 2-move template (see plyo.ts):
 *    Day 1 up-and-down + skipping, Day 2 single-leg + lateral, alternating; 2-3 sets each.
 *  Full (~45 min max): the 2 plyos, B1 compound (3x3-5 @ RPE 7),
 *    C1 posterior chain, C2 calf/foot, D1 hip flexor, D2 abduction/adduction.
 *    In-season: 1-2 plyos + 4-5 strength moves, never more than 6 total.
 *    Off-season: all 7 slots + 1 UPPER.
 *  Short (20 min): drop jumps 3x5, squat 3x3-5 superset calf raise 3x8-10, RDL 3x6.
 *  Plyos + Isos: 1-2 low/medium plyos, then 3-4 isometrics
 *    (overcoming: 3-5 s max pushes x5), including one calf/ankle.
 *  Taper (Championship race day, optional): a few overcoming isos incl. calf/ankle.
 *  Week off ("return"): optional, ~15 min, yielding isometrics only, 20-45 s holds,
 *    2-3 sets: one Achilles/calf iso, one hip/hamstring iso, and one more.
 *  Ramp week: Full (or Short) with no high-intensity moves, loaded moves at
 *    2-3 x 8-12 @ RPE 5-6; plyos low/medium only.
 *  Touch-up: 2-3 low-intensity foot/calf/hip-flexor moves, ~10 min.
 *  Long-run isos (long-run days, optional): 3 easy holds, 2 x 30 s, calf/ankle first.
 *  Race days: never a lift.
 *  Upper body (easy days; no leg loading): dumbbell moves only (unless the runner has
 *    no dumbbells), one body part per day, rotating so the
 *    one done longest ago is next (see nextUpperFocus in rules.ts):
 *      Back & biceps: vertical pull, row, curl, shoulder-blade move.
 *      Chest & triceps: 2 presses or push-ups, triceps, serratus.
 *      Shoulders: overhead press, lateral raise, rotator cuff, crawl or waiter carry.
 *    (No core or hip sessions: the team already does those at practice.)
 *
 *  Dosing: low sets, low reps, >70% effort, never to failure. Nordics max 3x3.
 *  Drop jumps: minimal ground contact; height isn't the goal.
 *  Plyo categories (deep, pogo, single-leg-hop, lateral) rotate across the week.
 *  Extra lateral volume (e.g. monster walks) only off-season and early season —
 *    handled by an exercise's optional `phases` list in the JSON.
 * ============================================================================
 */

import {
  ALL_EXERCISES,
  cueFor,
  isCalfAnkle,
  isoKind,
  isPlyo,
  restFor,
  videoFor,
} from "../exercises";
import { fitProfile, hasEquipment, matchesFocus, suitsExperience, wantsTendonEmphasis, type Profile } from "../profile";
import type { BlockPicks, Exercise, Phase, Slot, UpperFocus } from "../types";
import type { Decision } from "./rules";
import { pick } from "./select";
import type { VolumeTier } from "./volume";
import { PLYO_DAY, plyoFamily, plyoReps, type PlyoDay } from "./plyo";

/** Plyo categories that must each appear at least once per week. */
export const ROTATION_TYPES = ["deep", "pogo", "single-leg-hop", "lateral"] as const;

export const IN_SEASON_MAX_EXERCISES = 6;
export const FULL_MAX_MINUTES = 45;

export interface Prescription {
  /** Slot key used for block picks, e.g. "full:B1" or "plyos-isos:iso2". */
  key: string;
  slot: Slot;
  exercise: Exercise;
  sets: number;
  reps: string;
  rest: string;
  cue: string;
  videoUrl: string;
  note?: string;
  /** id of the exercise this is supersetted with (shown as a pair). */
  supersetWith?: string;
}

export interface BuildOptions {
  date: string;
  phase: Phase;
  attempt: number;
  block: BlockPicks | null;
  enablePower: boolean;
  enableMobility: boolean;
  /** Plyo categories already done in the last 7 days. */
  plyoTypesThisWeek: string[];
  /** Onboarding answers: equipment, experience, trouble spots, goals, event. */
  profile?: Profile | null;
  /** Full-session volume from weekly mileage (see volume.ts). Defaults to full. */
  volume?: VolumeTier;
  /** Which day of the coach's plyo template this session is (see plyo.ts). Defaults to Day 1. */
  plyoDay?: PlyoDay;
  pool?: Exercise[];
}

const PHASE_TAG: Record<Phase, string> = {
  off: "off-season",
  early: "early",
  deep: "deep",
  championship: "championship",
};

function allowedInPhase(e: Exercise, phase: Phase) {
  return !e.phases || e.phases.length === 0 || e.phases.includes(PHASE_TAG[phase]);
}

// ---------------------------------------------------------------------------
// Dosing helpers
// ---------------------------------------------------------------------------

function baseDose(e: Exercise, key: string, slot: Slot = e.slot): Prescription {
  return {
    key,
    slot,
    exercise: e,
    sets: e.sets ?? 3,
    // Some entries repeat the set count in reps ("2-3 x 20-45 s hold"); sets already says it.
    reps: e.sets && e.reps ? e.reps.replace(/^\d+(-\d+)?\s*x\s*/, "") : e.reps ?? "6-8",
    rest: restFor(e),
    cue: cueFor(e),
    videoUrl: videoFor(e),
  };
}

function isNordic(e: Exercise) {
  return /nordic/.test(e.id);
}

/** Global dosing caps that apply in every session. */
function applyCaps(p: Prescription): Prescription {
  if (isNordic(p.exercise)) {
    return { ...p, sets: Math.min(p.sets, 3), reps: "3", note: "Nordics max 3x3." };
  }
  if (/drop-jump/.test(p.exercise.id)) {
    return { ...p, note: "Minimal ground contact. Height isn't the goal." };
  }
  return p;
}

/** Overcoming isos: 3-5 s max pushes x5. */
function overcomingDose(p: Prescription): Prescription {
  const side = p.exercise.unilateral ? "/side" : "";
  return {
    ...p,
    sets: 5,
    reps: `3-5 s max push${side}`,
    rest: "15-20 s between pushes",
  };
}

function yieldingDose(p: Prescription): Prescription {
  const side = p.exercise.unilateral ? "/side" : "";
  return { ...p, sets: 3, reps: `20-45 s hold${side}`, rest: "30-60 s" };
}

function isoDose(p: Prescription): Prescription {
  return isoKind(p.exercise) === "overcoming" ? overcomingDose(p) : yieldingDose(p);
}

// ---------------------------------------------------------------------------
// Session builders
// ---------------------------------------------------------------------------

type Ctx = BuildOptions & { used: Set<string>; pool: Exercise[] };

function choose(ctx: Ctx, key: string, candidates: Exercise[], prefer?: (e: Exercise) => boolean) {
  return pick(candidates, { key, date: ctx.date, attempt: ctx.attempt, used: ctx.used, block: ctx.block, prefer });
}

/** Candidates for a slot, narrowed to the runner's equipment and experience (see profile.ts). */
function bySlot(ctx: Ctx, slot: Slot, session: string) {
  return fitProfile(
    ctx.pool.filter((e) => e.slot === slot && e.session_types.includes(session) && allowedInPhase(e, ctx.phase)),
    ctx.profile,
  );
}

/** Prefer exercises for the runner's trouble spots, if they named any. */
function preferFocus(ctx: Ctx): ((e: Exercise) => boolean) | undefined {
  const spots = ctx.profile?.troubleSpots ?? [];
  return spots.length ? (e) => matchesFocus(e, spots) : undefined;
}

function both(a?: (e: Exercise) => boolean, b?: (e: Exercise) => boolean) {
  if (!a) return b;
  if (!b) return a;
  return (e: Exercise) => a(e) && b(e);
}

function missingPlyoTypes(ctx: Ctx): string[] {
  return ROTATION_TYPES.filter((t) => !ctx.plyoTypesThisWeek.includes(t));
}

function preferMissing(ctx: Ctx) {
  const missing = missingPlyoTypes(ctx);
  return (e: Exercise) => !!e.plyo_type && missing.includes(e.plyo_type);
}

/**
 * The coach's plyo template: exactly 2 movements, from this session's day (Day 1: up-and-down +
 * skipping; Day 2: single-leg + lateral), 2-3 sets each, counted in contacts or meters.
 * `easyOnly` keeps both to low/medium intensity (Plyos + Isos sessions).
 */
function buildPlyos(ctx: Ctx, prefix: string, session: string, easyOnly: boolean): Prescription[] {
  const day = ctx.plyoDay ?? 1;
  const out: Prescription[] = [];
  PLYO_DAY[day].forEach((family, n) => {
    const fits = (tag: string) =>
      [...bySlot(ctx, "A1", tag), ...bySlot(ctx, "A2", tag)].filter(
        (e) => plyoFamily(e) === family && (!easyOnly || e.intensity !== "high"),
      );
    // Prefer moves tagged for this session; any plyo of the right kind otherwise.
    const pool = fits(session).length ? fits(session) : fits("full");
    const key = `${prefix}:day${day}-${n + 1}`;
    const e = choose(ctx, key, pool, preferMissing(ctx));
    if (!e) return;
    const p = applyCaps(baseDose(e, key));
    out.push({ ...p, sets: Math.min(3, Math.max(2, p.sets)), reps: plyoReps(p.reps) });
  });
  return out;
}

/**
 * Lower mileage, smaller sessions; it only ever grows. Base: 2 sets of everything.
 * Build: the main lift keeps 3, the rest 2. Full: the coach's dosing. Isos keep their own dosing.
 */
function volumeDose(p: Prescription, tier: VolumeTier): Prescription {
  if (tier === "full" || isoKind(p.exercise)) return p;
  if (tier === "build" && p.slot === "B1") return p;
  return { ...p, sets: Math.min(p.sets, 2) };
}

function buildFull(ctx: Ctx, d: Decision): Prescription[] {
  const offSeason = ctx.phase === "off";

  // Plyos first (fresh, right after the run): the coach's 2-move template.
  const plyos = d.plyos ? buildPlyos(ctx, "full", "full", false) : [];
  const slots: Slot[] = [];
  if (d.strength) {
    if (ctx.enablePower) slots.push("POWER");
    slots.push("B1", "C1", "C2", "D1", "D2");
    if (ctx.enableMobility) slots.push("MOBILITY");
    if (offSeason) slots.push("UPPER"); // max 1 UPPER, Full only
  }

  // In-season: never more than 6 exercises (the 2 plyos included). Drop in this order.
  if (!offSeason) {
    for (const drop of ["D2", "MOBILITY", "D1", "POWER"] as Slot[]) {
      if (slots.length + plyos.length <= IN_SEASON_MAX_EXERCISES) break;
      const i = slots.indexOf(drop);
      if (i >= 0) slots.splice(i, 1);
    }
  }

  const out: Prescription[] = plyos.map((p) => volumeDose(d.half ? { ...p, sets: Math.max(1, Math.round(p.sets / 2)) } : p, ctx.volume ?? "full"));
  for (const slot of slots) {
    const key = `full:${slot}`;
    const prefer = isPlyo({ slot } as Exercise)
      ? preferMissing(ctx)
      : slot === "C2" && wantsTendonEmphasis(ctx.profile)
        ? (e: Exercise) => !!isoKind(e) && isCalfAnkle(e)
        : preferFocus(ctx);
    const e = choose(ctx, key, bySlot(ctx, slot, "full"), prefer);
    if (!e) continue;
    let p = baseDose(e, key);
    if (slot === "B1") p = { ...p, sets: 3, reps: "3-5", note: "@ RPE 7: leave 3 reps in the tank." };
    if (isoKind(e) === "overcoming") p = overcomingDose(p);
    p = applyCaps(p);
    if (d.half) p = { ...p, sets: Math.max(1, Math.round(p.sets / 2)) };
    p = volumeDose(p, ctx.volume ?? "full");
    out.push(p);
  }
  return out;
}

function buildShort(ctx: Ctx, d: Decision): Prescription[] {
  const out: Prescription[] = [];
  // The coach's Short template picks first; if none suit this runner's gear or
  // experience, use the closest Full option for the slot instead.
  const firstOf = (slot: Slot) => {
    const short = ctx.pool.filter((e) => e.slot === slot && e.session_types.includes("short"));
    const fits = ctx.profile
      ? short.filter((e) => hasEquipment(e, ctx.profile!.equipment) && suitsExperience(e, ctx.profile!.experience))
      : short;
    return fits.length ? fits : bySlot(ctx, slot, "full");
  };
  // Short on time: the same 2-move plyo template, 2 sets each.
  if (d.plyos) out.push(...buildPlyos(ctx, "short", "full", false).map((p) => ({ ...p, sets: 2 })));
  const squat = choose(ctx, "short:B1", firstOf("B1"));
  const calf = choose(ctx, "short:C2", firstOf("C2"));
  const rdl = choose(ctx, "short:C1", firstOf("C1"));
  if (squat) {
    out.push({
      ...baseDose(squat, "short:B1"),
      sets: 3,
      reps: "3-5",
      rest: "superset, then 2 min",
      note: "@ RPE 7. Superset with the calf raise.",
      supersetWith: calf?.id,
    });
  }
  if (calf) {
    out.push({ ...baseDose(calf, "short:C2"), sets: 3, reps: calf.unilateral ? "8-10/side" : "8-10", rest: "straight back to squat", supersetWith: squat?.id });
  }
  if (rdl) out.push(applyCaps({ ...baseDose(rdl, "short:C1"), sets: 3, reps: rdl.unilateral ? "6/side" : "6" }));
  return out;
}

function isoPool(ctx: Ctx, session: string, kinds: ("overcoming" | "yielding" | "hold")[]): Exercise[] {
  return fitProfile(
    ctx.pool.filter((e) => {
      const k = isoKind(e);
      return !!k && kinds.includes(k) && e.session_types.includes(session) && e.slot !== "UPPER" && allowedInPhase(e, ctx.phase);
    }),
    ctx.profile,
  );
}

/** Pick `count` isometrics for a session tag, the first one calf/ankle, spreading slots. */
function pickIsos(
  ctx: Ctx,
  session: string,
  count: number,
  kinds: ("overcoming" | "yielding" | "hold")[],
): Exercise[] {
  const isos = isoPool(ctx, session, kinds);
  const preferKind = both((e: Exercise) => isoKind(e) === kinds[0], preferFocus(ctx))!;
  const chosen: Exercise[] = [];
  const first = choose(ctx, `${session}:iso1`, isos.filter(isCalfAnkle), preferKind);
  if (first) chosen.push(first);
  for (let i = chosen.length; i < count; i++) {
    const usedSlots = new Set(chosen.map((c) => c.slot));
    const e = choose(ctx, `${session}:iso${i + 1}`, isos, (x) => !usedSlots.has(x.slot) && preferKind(x));
    if (!e) break;
    chosen.push(e);
  }
  return chosen;
}

function buildPlyosIsos(ctx: Ctx, d: Decision): Prescription[] {
  const out: Prescription[] = [];
  // The coach's 2-move plyo template, kept to low/medium intensity here.
  if (d.plyos) out.push(...buildPlyos(ctx, "plyos-isos", "plyos-isos", true));
  const isoCount = d.plyos ? 3 : 4;
  const isos = pickIsos(ctx, "plyos-isos", isoCount, ["overcoming", "hold"]);
  isos.forEach((e, i) => out.push(isoDose(baseDose(e, `plyos-isos:iso${i + 1}`))));
  return out;
}

function buildTaper(ctx: Ctx): Prescription[] {
  return pickIsos(ctx, "taper", 2, ["overcoming", "hold"]).map((e, i) =>
    isoDose(baseDose(e, `taper:iso${i + 1}`)),
  );
}

/** Hip and hamstring slots: posterior chain, hip flexors, adductors/abductors. */
const HIP_HAM_SLOTS: Slot[] = ["C1", "D1", "D2"];

/**
 * Week off: one Achilles/calf iso, one hip/hamstring iso, one more from another slot.
 * Yielding holds, 20-45 s, 3 sets (2 when done one side at a time). About 15 minutes.
 */
function buildReturn(ctx: Ctx): Prescription[] {
  const pool = isoPool(ctx, "return", ["yielding", "hold"]);
  const prefer = both((e: Exercise) => isoKind(e) === "yielding", preferFocus(ctx));
  const chosen: Exercise[] = [];
  const add = (key: string, candidates: Exercise[]) => {
    const e = choose(ctx, key, candidates, prefer);
    if (e) chosen.push(e);
  };
  add("return:calf", pool.filter(isCalfAnkle));
  add("return:hip", pool.filter((e) => HIP_HAM_SLOTS.includes(e.slot)));
  const usedSlots = new Set(chosen.map((c) => c.slot));
  add("return:iso3", pool.filter((e) => !usedSlots.has(e.slot)).length ? pool.filter((e) => !usedSlots.has(e.slot)) : pool);
  return chosen.map((e, i) => {
    const p = yieldingDose(baseDose(e, `return:iso${i + 1}`));
    return {
      ...p,
      sets: e.unilateral ? 2 : 3,
      note: i === 0 ? "Week off: easy holds, about 15 min. Optional: skip it if you'd rather rest." : undefined,
    };
  });
}

/** Long-run day: 3 easy holds (calf/ankle first), 2 x 30 s. Tendon-friendly, no real load. */
function buildLongIsos(ctx: Ctx): Prescription[] {
  return pickIsos(ctx, "return", 3, ["yielding", "hold"]).map((e, i) => {
    const p = yieldingDose(baseDose(e, `long-isos:iso${i + 1}`));
    return { ...p, sets: 2, reps: `30 s hold${e.unilateral ? "/side" : ""}`, rest: "30 s", note: i === 0 ? "Easy holds after the long run. Skip it if your legs are toast." : undefined };
  });
}

function buildTouchUp(ctx: Ctx): Prescription[] {
  const pool = (slot: Slot) => {
    const all = bySlot(ctx, slot, "touch-up");
    const low = all.filter((e) => e.intensity === "low");
    return low.length ? low : all;
  };
  const plan: [string, Slot][] = [
    ["touch-up:foot", "C2"],
    ["touch-up:hip", "D1"],
    ["touch-up:calf", "C2"],
  ];
  const out: Prescription[] = [];
  for (const [key, slot] of plan) {
    const e = choose(ctx, key, pool(slot), preferFocus(ctx));
    if (!e) continue;
    let p = { ...baseDose(e, key), sets: Math.min(e.sets ?? 2, 2) };
    if (isoKind(e) === "overcoming") p = overcomingDose(p);
    out.push(p);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Easy-day upper body
// ---------------------------------------------------------------------------

interface UpperGroup {
  key: string;
  match: RegExp;
  sets: number;
  reps: string;
  rest: string;
  /** Main lifts get the "leave reps in the tank" note. */
  main?: boolean;
}

const SHOULDER_BLADE = /pull-apart|atyt|iyt|^wy$|w-on-bench|snow-angel|rear-delt-fly/;

/** One template per body part. Each is 4 moves, about 20 minutes. */
const UPPER_DAYS: Record<UpperFocus, UpperGroup[]> = {
  back: [
    { key: "vertical", match: /^(pull-up|pull-up-eccentric-only|chin-up|cable-lat-pull-down|band-lat-pull-down|dumbbell-pullover)$/, sets: 3, reps: "6-10", rest: "60-90 s", main: true },
    { key: "row", match: /row/, sets: 3, reps: "8-10", rest: "60-90 s", main: true },
    { key: "biceps", match: /curl/, sets: 2, reps: "10-12", rest: "45 s" },
    { key: "rear", match: SHOULDER_BLADE, sets: 2, reps: "10", rest: "30 s" },
  ],
  chest: [
    { key: "press", match: /bench-press|^push-up$|hand-pick-up-push-up/, sets: 3, reps: "8-10", rest: "60-90 s", main: true },
    { key: "press2", match: /bench-press|^push-up$|hand-pick-up-push-up/, sets: 2, reps: "10-12", rest: "60 s" },
    { key: "triceps", match: /triceps|close-grip/, sets: 2, reps: "10-12", rest: "45 s" },
    { key: "serratus", match: /serratus|scap-push-up/, sets: 2, reps: "10", rest: "30 s" },
  ],
  shoulders: [
    { key: "press", match: /overhead-press|overhead-dumbbell-press|^landmine-press$|^z-press$/, sets: 3, reps: "8-10", rest: "60-90 s", main: true },
    { key: "lateral", match: /lateral-raise/, sets: 2, reps: "12", rest: "45 s" },
    { key: "cuff", match: /external-rotation/, sets: 2, reps: "10", rest: "30 s" },
    { key: "stability", match: /crawl|waiter-carry/, sets: 2, reps: "30 s", rest: "45 s" },
  ],
};

/** Bodyweight-friendly unilateral reps get a "/side". */
function perSide(e: Exercise, reps: string) {
  if (/ s$/.test(reps)) return reps;
  return e.unilateral || /single-arm|single arm|contralateral|offset/.test(`${e.id} ${e.name}`.toLowerCase()) ? `${reps}/side` : reps;
}

/** Upper-body days are dumbbell-only for anyone with dumbbells (gym or home). */
const usesDumbbells = (e: Exercise) => /dumbbell/i.test(e.equipment ?? "");
function hasDumbbells(profile: Profile | null | undefined) {
  return !profile || profile.equipment !== "minimal";
}

function buildUpper(ctx: Ctx, focus: UpperFocus): Prescription[] {
  const all = ctx.pool.filter((e) => e.slot === "UPPER" && !isoKind(e) && !/med-ball/.test(e.id));
  const upper = hasDumbbells(ctx.profile) ? all.filter(usesDumbbells) : all;
  const out: Prescription[] = [];
  for (const g of UPPER_DAYS[focus]) {
    const key = `upper-${focus}:${g.key}`;
    const e = choose(ctx, key, fitProfile(upper.filter((x) => g.match.test(x.id) && !ctx.used.has(x.id)), ctx.profile));
    if (!e) continue;
    out.push({
      ...baseDose(e, key),
      sets: g.sets,
      reps: perSide(e, g.reps),
      rest: g.rest,
      note: g.main ? "Easy day: leave 2-3 reps in the tank." : undefined,
    });
  }
  return out;
}

/** Ramp week: loaded moves at 2-3 x 8-12 @ RPE 5-6. Plyos and isos keep their own dosing. */
export function rampDose(p: Prescription): Prescription {
  if (isPlyo(p.exercise) || isoKind(p.exercise)) return p;
  return {
    ...p,
    sets: Math.min(3, Math.max(2, p.sets)),
    reps: p.exercise.unilateral ? "8-12/side" : "8-12",
    rest: p.supersetWith ? p.rest : "60-90 s",
    note: "Ramp week: @ RPE 5-6, lighter than usual. Stop with 4-5 reps left.",
  };
}

export function buildItems(d: Decision, opts: BuildOptions): Prescription[] {
  const ctx: Ctx = { ...opts, used: new Set(), pool: opts.pool ?? ALL_EXERCISES };
  // POWER/MOBILITY only when turned on; UPPER only via the Full and Upper builders.
  ctx.pool = ctx.pool.filter(
    (e) =>
      (e.slot !== "POWER" || opts.enablePower) &&
      (e.slot !== "MOBILITY" || opts.enableMobility),
  );
  // Ramp week: nothing high-intensity (so plyos are low/medium), lighter dosing on loaded moves.
  if (d.ramp) ctx.pool = ctx.pool.filter((e) => e.intensity !== "high");
  switch (d.session) {
    case "full":
      return d.ramp ? buildFull(ctx, d).map(rampDose) : buildFull(ctx, d);
    case "short":
      return d.ramp ? buildShort(ctx, d).map(rampDose) : buildShort(ctx, d);
    case "plyos-isos":
      return buildPlyosIsos(ctx, d);
    case "taper":
      return buildTaper(ctx);
    case "return":
      return buildReturn(ctx);
    case "touch-up":
      return buildTouchUp(ctx);
    case "upper":
      return buildUpper(ctx, d.upperFocus ?? "back");
    case "long-isos":
      return buildLongIsos(ctx);
    case "none":
      return [];
  }
}

// ---------------------------------------------------------------------------
// Warm-up + duration
// ---------------------------------------------------------------------------

export function warmupFor(d: Decision): string[] {
  switch (d.session) {
    case "full":
    case "short":
      return [
        "You just ran, so keep this short (about 5 min)",
        "Leg swings, front/back and side, 10 each",
        "A-skips and B-skips, 2 x 20 m",
        "Low pogos, 2 x 10",
        "1-2 light ramp-up sets before your first loaded lift",
      ];
    case "plyos-isos":
      return ["Leg swings, 10 each direction", "A-skips, 2 x 20 m", "Ankle rocks, 10/side"];
    case "upper":
      return ["Arm circles, 10 each way", "Wall slides, 10", "1 light set of your first two moves"];
    case "none":
      return [];
    default:
      return ["Leg swings, 10 each direction", "Ankle rocks, 10/side"];
  }
}

function seconds(text: string): number | null {
  const m = text.match(/(\d+)(?:\s*-\s*(\d+))?\s*(s|sec|min)/);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  const avg = (lo + hi) / 2;
  return m[3] === "min" ? avg * 60 : avg;
}

function restSeconds(rest: string): number {
  if (/superset|straight back/i.test(rest)) return /then/.test(rest) ? seconds(rest.split("then")[1]) ?? 90 : 0;
  const betweenSets = rest.match(/(\d+[^,]*?)between sets/);
  if (betweenSets) return seconds(betweenSets[1]) ?? 60;
  if (/walk back/i.test(rest)) return 45;
  return seconds(rest) ?? 60;
}

function workSeconds(p: Prescription): number {
  const reps = p.reps;
  const mult = p.exercise.unilateral || /side/.test(reps) ? 2 : 1;
  const xMatch = reps.match(/^(\d+)\s*x\s*(.*)$/); // "5 x 3-5 s"
  if (xMatch) return Number(xMatch[1]) * ((seconds(xMatch[2]) ?? 5) + 10) * mult;
  if (/ m\b|m$/.test(reps)) return 25 * mult;
  const s = seconds(reps);
  if (s !== null) return s * mult;
  return 30 * mult;
}

export function estimateMinutes(d: Decision, items: Prescription[]): number {
  const warm = { full: 5, short: 4, "plyos-isos": 4, taper: 2, return: 2, "touch-up": 2, upper: 3, "long-isos": 1, none: 0 }[d.session];
  const work = items.reduce((sum, p) => sum + p.sets * (workSeconds(p) + restSeconds(p.rest)), 0);
  const total = warm + work / 60;
  return Math.max(5, Math.round(total / 5) * 5);
}
