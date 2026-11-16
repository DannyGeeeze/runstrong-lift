/**
 * ============================================================================
 *  RUNNER PROFILE — answers from onboarding and how they shape training.
 * ============================================================================
 *  The coach's rules (rules.ts) still decide WHEN and WHAT KIND of session.
 *  The profile only changes WHICH exercises fill each slot:
 *
 *  - equipment: exercises needing gear you don't have are skipped.
 *  - experience "new": high-intensity moves (heavy barbell, Nordics, deep drop
 *    jumps) are skipped while a gentler option exists in the slot.
 *  - troubleSpots: exercises for those areas move to the front of their slot.
 *  - goals "kick" / "economy": Full sessions get 2 plyos (A1 + A2) in-season,
 *    still capped at 6 moves total.
 *  - sessionMinutes 20: the Today screen starts with "Short on time" on.
 *
 *  Every filter falls back to the unfiltered list if it would empty a slot,
 *  so a session is never missing a slot because of the profile.
 * ============================================================================
 */

import type { Exercise, Weekday } from "./types";

export type Experience = "new" | "some" | "solid";
export type EquipmentAccess = "gym" | "home" | "minimal";
export type Goal = "kick" | "healthy" | "economy" | "strength";
export type TroubleSpot = "shins" | "calves" | "feet" | "knees" | "hips" | "hamstrings";
export type EventFocus = "xc" | "distance" | "mid" | "long";

export interface Profile {
  name: string;
  event: EventFocus;
  weeklyMiles: number;
  experience: Experience;
  equipment: EquipmentAccess;
  goals: Goal[];
  troubleSpots: TroubleSpot[];
  sessionMinutes: 20 | 30 | 45;
  raceDay: Weekday;
  completedAt: string;
}

// ---------------------------------------------------------------------------
// Equipment
// ---------------------------------------------------------------------------

/** Gear assumed for each access level. "gym" means everything. */
const MINIMAL = ["bodyweight", "none", "band", "box", "bench", "foam roller", "slider", "step"];
const HOME = [...MINIMAL, "dumbbells", "dumbbell", "kettlebell", "med ball", "physioball", "plate", "bosu", "slant board"];

/**
 * Equipment strings look like "dumbbells", "dumbbells, slider" (needs both) or
 * "cable or band" (needs either).
 */
export function hasEquipment(e: Exercise, access: EquipmentAccess): boolean {
  if (access === "gym" || !e.equipment) return true;
  const have = access === "home" ? HOME : MINIMAL;
  return e.equipment
    .toLowerCase()
    .split(",")
    .every((part) => part.split(" or ").some((opt) => have.includes(opt.trim())));
}

// ---------------------------------------------------------------------------
// Experience
// ---------------------------------------------------------------------------

export function suitsExperience(e: Exercise, experience: Experience): boolean {
  if (experience !== "new") return true;
  return e.intensity !== "high" && !/nordic/.test(e.id);
}

/**
 * Narrow a slot's candidates for this profile, relaxing one rule at a time if a
 * stricter filter would leave nothing.
 */
export function fitProfile(candidates: Exercise[], profile: Profile | null | undefined): Exercise[] {
  if (!profile) return candidates;
  const both = candidates.filter((e) => hasEquipment(e, profile.equipment) && suitsExperience(e, profile.experience));
  if (both.length) return both;
  const gear = candidates.filter((e) => hasEquipment(e, profile.equipment));
  if (gear.length) return gear;
  return candidates;
}

// ---------------------------------------------------------------------------
// Trouble spots
// ---------------------------------------------------------------------------

const SPOT_PATTERNS: Record<TroubleSpot, RegExp> = {
  shins: /tib|shin|heel-walk|toe-walk|dorsi/,
  calves: /calf|achilles|soleus|ankle/,
  feet: /toe|foot|arch|short-foot|balance/,
  knees: /split-squat|ss-iso|spanish|step|knee|wall-sit/,
  hips: /hip|glute|abduct|adduct|copenhagen|monster|airplane|clam/,
  hamstrings: /ham|rdl|bridge/,
};

export function matchesFocus(e: Exercise, spots: TroubleSpot[]): boolean {
  const text = `${e.id} ${e.name}`.toLowerCase();
  return spots.some((s) => SPOT_PATTERNS[s].test(text));
}

export function wantsPlyoEmphasis(profile: Profile | null | undefined): boolean {
  return !!profile && (profile.goals.includes("kick") || profile.goals.includes("economy"));
}

// ---------------------------------------------------------------------------
// Labels (shared by onboarding and Settings)
// ---------------------------------------------------------------------------

export const EVENT_OPTIONS: { value: EventFocus; label: string; hint: string; icon: string }[] = [
  { value: "xc", label: "Cross country", hint: "5K over grass and hills", icon: "🌲" },
  { value: "distance", label: "1600 / 3200", hint: "Distance on the track", icon: "🏟️" },
  { value: "mid", label: "800 / mile", hint: "Middle distance, speed matters", icon: "⚡" },
  { value: "long", label: "Longer stuff", hint: "10K, half, road races", icon: "🛣️" },
];

export const EXPERIENCE_OPTIONS: { value: Experience; label: string; hint: string; icon: string }[] = [
  { value: "new", label: "Brand new", hint: "I've barely touched a barbell. Teach me.", icon: "🌱" },
  { value: "some", label: "Some experience", hint: "I've done team lifts or a few months on my own.", icon: "💪" },
  { value: "solid", label: "I know my way around", hint: "Squats, RDLs and box jumps feel familiar.", icon: "🏋️" },
];

export const EQUIPMENT_OPTIONS: { value: EquipmentAccess; label: string; hint: string; icon: string }[] = [
  { value: "gym", label: "Full gym", hint: "Barbells, racks, machines (school weight room counts)", icon: "🏫" },
  { value: "home", label: "Home setup", hint: "Dumbbells or kettlebells, bands, a box or bench", icon: "🏠" },
  { value: "minimal", label: "Just me", hint: "Bodyweight, a band, stairs or a bench", icon: "🎒" },
];

export const GOAL_OPTIONS: { value: Goal; label: string; hint: string; icon: string }[] = [
  { value: "kick", label: "Faster finishing kick", hint: "More pop in the last 200", icon: "🚀" },
  { value: "healthy", label: "Stay healthy all season", hint: "Fewer niggles, more training days", icon: "🛡️" },
  { value: "economy", label: "Run more efficiently", hint: "Springier stride, same pace for less effort", icon: "🦘" },
  { value: "strength", label: "Get stronger overall", hint: "Build a base that lasts years", icon: "🧱" },
];

export const SPOT_OPTIONS: { value: TroubleSpot; label: string }[] = [
  { value: "shins", label: "Shins" },
  { value: "calves", label: "Calves / Achilles" },
  { value: "feet", label: "Feet" },
  { value: "knees", label: "Knees" },
  { value: "hips", label: "Hips / IT band" },
  { value: "hamstrings", label: "Hamstrings" },
];
