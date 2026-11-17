// Loads the exercise bank. Adding an exercise = adding a JSON entry; nothing here needs to change.

import bank from "@/data/runstrong_exercises.json";
import type { Exercise, IsoKind, Slot } from "./types";

interface Bank {
  _meta: { slots: Record<string, string>; [k: string]: unknown };
  featured: Exercise[];
  library: Exercise[];
}

const data = bank as unknown as Bank;

/**
 * Featured exercises are tagged featured=true so selection can weight them.
 * If an id appears in both lists, the featured entry (the coach's own dosing) wins.
 */
const featuredIds = new Set(data.featured.map((e) => e.id));
export const ALL_EXERCISES: Exercise[] = [
  ...data.featured.map((e) => ({ ...e, featured: true })),
  ...data.library.filter((e) => !featuredIds.has(e.id)).map((e) => ({ ...e, featured: e.featured ?? false })),
];

export const SLOT_NAMES: Record<string, string> = data._meta.slots;

const byId = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
export function getExercise(id: string): Exercise | undefined {
  return byId.get(id);
}

/**
 * What kind of isometric an exercise is, or null if it isn't one.
 * Uses the `isometric` field when present, otherwise reads the name/id and reps,
 * because the featured entries don't carry the field.
 */
export function isoKind(e: Exercise): IsoKind | null {
  const tag = (e.isometric ?? "").toLowerCase();
  const text = `${e.id} ${e.name}`.toLowerCase();
  if (tag === "overcoming" || text.includes("overcoming")) return "overcoming";
  if (tag === "yielding" || text.includes("yielding")) return "yielding";
  const isIso = tag === "iso" || e.slot === "ISO" || /\biso\b|-iso\b|-iso-/.test(text);
  if (!isIso) return null;
  // "5 x 3-5 s" style reps are short max pushes; longer holds are yielding-style holds.
  return /3-5 s/.test(e.reps ?? "") ? "overcoming" : "hold";
}

export function isPlyo(e: Exercise): boolean {
  return e.slot === "A1" || e.slot === "A2";
}

/** Calf / foot / ankle work, used for "include one calf/ankle iso". */
export function isCalfAnkle(e: Exercise): boolean {
  return e.slot === "C2" || /ankle|calf|achilles|toe|tib/.test(`${e.id} ${e.name}`.toLowerCase());
}

export function exercisesFor(slot: Slot, session: string, pool: Exercise[] = ALL_EXERCISES) {
  return pool.filter((e) => e.slot === slot && e.session_types.includes(session));
}

/** Library entries have no cue; give a sensible slot-based one. */
const DEFAULT_CUES: Record<string, string> = {
  A1: "Quick, stiff ankles, minimal ground contact. Quality over height.",
  A2: "Stick each landing for a beat, then go. Stay tall.",
  B1: "Move the weight fast on the way up. Stop 2–3 reps shy of failure.",
  POWER: "Explosive and crisp. Stop the set when speed drops.",
  C1: "Hinge at the hips, long spine, feel the hamstrings load.",
  C2: "Full range, pause at the top, control the lowering.",
  D1: "Drive the knee up hard without leaning back.",
  D2: "Hips level, slow and controlled.",
  ISO: "Brace and hold position. Breathe.",
  MOBILITY: "Slow, controlled range. No forcing it.",
  UPPER: "Tall posture, shoulder blades down and back.",
  CORE: "Brace like you're about to be poked in the stomach. Breathe behind the brace.",
};

export function cueFor(e: Exercise): string {
  return e.cue ?? DEFAULT_CUES[e.slot] ?? "Smooth, controlled reps.";
}

const DEFAULT_REST: Record<string, string> = {
  A1: "60 s",
  A2: "60 s",
  B1: "2-3 min",
  POWER: "2 min",
  C1: "90 s",
  C2: "60 s",
  D1: "45 s",
  D2: "45 s",
  ISO: "45 s",
  MOBILITY: "30 s",
  UPPER: "60 s",
  CORE: "30 s",
};

export function restFor(e: Exercise): string {
  return e.rest ?? DEFAULT_REST[e.slot] ?? "60 s";
}

/**
 * Featured exercises have no video_url. Library video_urls are the coach's category browse
 * pages, so featured entries link to the same page for their slot.
 */
const SITE = "https://www.therunstrongcoach.com";
const SLOT_VIDEO_PAGE: Record<string, string> = {
  A1: `${SITE}/exercise-browse-plyometrics`,
  A2: `${SITE}/exercise-browse-plyometrics`,
  B1: `${SITE}/exercise-browse-lower-body`,
  POWER: `${SITE}/exercise-browse-lower-body`,
  ISO: `${SITE}/exercise-browse-lower-body`,
  C1: `${SITE}/exercise-browse-posterior-chain`,
  C2: `${SITE}/exercise-browse-ankle`,
  D1: `${SITE}/exercise-browse-hip-flexor`,
  D2: `${SITE}/exercise-browse-hip-flexor`,
  MOBILITY: `${SITE}/exercise-browse-hip-flexor`,
  UPPER: `${SITE}/exercise-browse-upper-body`,
};

export function videoFor(e: Exercise): string {
  return e.video_url ?? SLOT_VIDEO_PAGE[e.slot] ?? SITE;
}
