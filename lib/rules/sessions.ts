/**
 * ============================================================================
 *  SESSION TEMPLATES + DOSING — what goes into each session type.
 * ============================================================================
 *  Full (~45 min max): A1 vertical plyo, A2 lateral plyo, B1 compound (3x3-5 @ RPE 7),
 *    C1 posterior chain, C2 calf/foot, D1 hip flexor, D2 abduction/adduction.
 *    In-season: 1-2 plyos + 4-5 strength moves, never more than 6 total.
 *    Off-season: all 7 slots + 1 UPPER.
 *  Short (20 min): drop jumps 3x5, squat 3x3-5 superset calf raise 3x8-10, RDL 3x6.
 *  Plyos + Isos: 1-2 low/medium plyos, then 3-4 isometrics
 *    (overcoming: 3-5 s max pushes x5), including one calf/ankle.
 *  Taper (Championship race day, optional): a few overcoming isos incl. calf/ankle.
 *  Return week: yielding isometrics only, 20-45 s holds.
 *  Touch-up: 2-3 low-intensity foot/calf/hip-flexor moves, ~10 min.
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
import { fitProfile, hasEquipment, matchesFocus, suitsExperience, wantsPlyoEmphasis, type Profile } from "../profile";
import type { BlockPicks, Exercise, Phase, Slot } from "../types";
import type { Decision } from "./rules";
import { pick } from "./select";

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
  /** Onboarding answers: equipment, experience, trouble spots, goals. */
  profile?: Profile | null;
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
    note: "Push as hard as you can against something that won't move.",
  };
}

function yieldingDose(p: Prescription): Prescription {
  const side = p.exercise.unilateral ? "/side" : "";
  return { ...p, sets: 3, reps: `20-45 s hold${side}`, rest: "30-60 s", note: "Hold the position, don't let it sag." };
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

function buildFull(ctx: Ctx, d: Decision): Prescription[] {
  const offSeason = ctx.phase === "off";
  const lateralDue = missingPlyoTypes(ctx).includes("lateral");

  const slots: Slot[] = [];
  if (d.plyos) {
    slots.push("A1");
    // Goals "faster kick" / "run more efficiently" → always 2 plyos.
    if (offSeason || lateralDue || wantsPlyoEmphasis(ctx.profile)) slots.push("A2");
  }
  if (d.strength) {
    if (ctx.enablePower) slots.push("POWER");
    slots.push("B1", "C1", "C2", "D1", "D2");
    if (ctx.enableMobility) slots.push("MOBILITY");
    if (offSeason) slots.push("UPPER"); // max 1 UPPER, Full only
  }

  // In-season: never more than 6 exercises. Drop in this order.
  if (!offSeason) {
    for (const drop of ["D2", "MOBILITY", "D1", "POWER"] as Slot[]) {
      if (slots.length <= IN_SEASON_MAX_EXERCISES) break;
      const i = slots.indexOf(drop);
      if (i >= 0) slots.splice(i, 1);
    }
  }

  const out: Prescription[] = [];
  for (const slot of slots) {
    const key = `full:${slot}`;
    const e = choose(ctx, key, bySlot(ctx, slot, "full"), isPlyo({ slot } as Exercise) ? preferMissing(ctx) : preferFocus(ctx));
    if (!e) continue;
    let p = baseDose(e, key);
    if (slot === "B1") p = { ...p, sets: 3, reps: "3-5", note: "@ RPE 7: leave 3 reps in the tank." };
    if (isoKind(e) === "overcoming") p = overcomingDose(p);
    p = applyCaps(p);
    if (d.half) p = { ...p, sets: Math.max(1, Math.round(p.sets / 2)) };
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
  if (d.plyos) {
    const dj = choose(ctx, "short:A1", firstOf("A1"));
    if (dj) out.push(applyCaps({ ...baseDose(dj, "short:A1"), sets: 3, reps: "5" }));
  }
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

/** Pick `count` isometrics for a session tag, the first one calf/ankle, spreading slots. */
function pickIsos(
  ctx: Ctx,
  session: string,
  count: number,
  kinds: ("overcoming" | "yielding" | "hold")[],
): Exercise[] {
  const isos = fitProfile(ctx.pool.filter((e) => {
    const k = isoKind(e);
    return (
      !!k &&
      kinds.includes(k) &&
      e.session_types.includes(session) &&
      e.slot !== "UPPER" &&
      allowedInPhase(e, ctx.phase)
    );
  }), ctx.profile);
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
  if (d.plyos) {
    const lowMed = (slot: Slot) =>
      bySlot(ctx, slot, "plyos-isos").filter((e) => e.intensity === "low" || e.intensity === "med");
    const a1 = choose(ctx, "plyos-isos:A1", lowMed("A1"), preferMissing(ctx));
    if (a1) out.push(baseDose(a1, "plyos-isos:A1"));
    if (missingPlyoTypes(ctx).includes("lateral")) {
      const a2 = choose(ctx, "plyos-isos:A2", lowMed("A2"));
      if (a2) out.push(baseDose(a2, "plyos-isos:A2"));
    }
  }
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

function buildReturn(ctx: Ctx): Prescription[] {
  return pickIsos(ctx, "return", 3, ["yielding", "hold"]).map((e, i) =>
    yieldingDose(baseDose(e, `return:iso${i + 1}`)),
  );
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

export function buildItems(d: Decision, opts: BuildOptions): Prescription[] {
  const ctx: Ctx = { ...opts, used: new Set(), pool: opts.pool ?? ALL_EXERCISES };
  // POWER/MOBILITY only when turned on; UPPER only via the Full builder.
  ctx.pool = ctx.pool.filter(
    (e) =>
      (e.slot !== "POWER" || opts.enablePower) &&
      (e.slot !== "MOBILITY" || opts.enableMobility),
  );
  switch (d.session) {
    case "full":
      return buildFull(ctx, d);
    case "short":
      return buildShort(ctx, d);
    case "plyos-isos":
      return buildPlyosIsos(ctx, d);
    case "taper":
      return buildTaper(ctx);
    case "return":
      return buildReturn(ctx);
    case "touch-up":
      return buildTouchUp(ctx);
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
  const warm = { full: 5, short: 4, "plyos-isos": 4, taper: 2, return: 2, "touch-up": 2, none: 0 }[d.session];
  const work = items.reduce((sum, p) => sum + p.sets * (workSeconds(p) + restSeconds(p.rest)), 0);
  const total = warm + work / 60;
  return Math.max(5, Math.round(total / 5) * 5);
}
