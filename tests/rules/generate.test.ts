import { describe, expect, it } from "vitest";
import { plyoFamily } from "@/lib/rules/plyo";
import { addToBlock, generateWorkout, type GenerateInput, type Workout } from "@/lib/rules";
import { ALL_EXERCISES, isoKind, isCalfAnkle } from "@/lib/exercises";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { Phase, RunType } from "@/lib/types";

const TUE = "2026-09-15";
const MON = "2026-09-14";

function input(over: Partial<GenerateInput> & { today: string; dayType: RunType; phase: Phase }): GenerateInput {
  return {
    races: [],
    history: [],
    block: null,
    ...over,
    settings: { ...DEFAULT_SETTINGS, ...(over.settings ?? {}) },
  };
}

/** Invariants every generated workout must keep. */
function checkRules(w: Workout, phase: Phase, opts = { enablePower: false, enableMobility: false }) {
  const session = w.decision.session === "plyos-isos" ? "plyos-isos" : w.decision.session;
  const ids = w.items.map((i) => i.exercise.id);
  expect(new Set(ids).size).toBe(ids.length); // no duplicates
  for (const i of w.items) {
    // Short sessions take their 2 plyos from the Full list (the coach's template).
    const tags = i.exercise.session_types;
    expect(tags.includes(session) || (session === "short" && tags.includes("full")), `${session}: ${i.exercise.id}`).toBe(true);
    expect(i.videoUrl).toMatch(/^https:\/\//);
    if (!opts.enablePower) expect(i.slot).not.toBe("POWER");
    if (!opts.enableMobility) expect(i.slot).not.toBe("MOBILITY");
    if (/nordic/.test(i.exercise.id)) {
      expect(i.sets).toBeLessThanOrEqual(3);
      expect(i.reps).toBe("3");
    }
  }
  const upper = w.items.filter((i) => i.slot === "UPPER");
  expect(upper.length).toBeLessThanOrEqual(1);
  if (upper.length) expect(w.decision.session).toBe("full");

  if (w.decision.session === "full" && phase !== "off") {
    const plyos = w.items.filter((i) => i.slot === "A1" || i.slot === "A2").length;
    expect(w.items.length).toBeLessThanOrEqual(6);
    if (w.decision.plyos) expect(plyos).toBeGreaterThanOrEqual(1);
    expect(plyos).toBeLessThanOrEqual(2);
    expect(w.estMinutes).toBeLessThanOrEqual(45);
  }
  if (w.decision.session === "plyos-isos") {
    const plyos = w.items.filter((i) => i.slot === "A1" || i.slot === "A2");
    const isos = w.items.filter((i) => isoKind(i.exercise));
    for (const p of plyos) expect(["low", "med"]).toContain(p.exercise.intensity);
    expect(plyos.length).toBeLessThanOrEqual(2);
    expect(isos.length).toBeGreaterThanOrEqual(3);
    expect(isos.length).toBeLessThanOrEqual(4);
    expect(isos.some((i) => isCalfAnkle(i.exercise))).toBe(true);
  }
}

describe("generated workouts", () => {
  it("in-season Full: slot order, B1 3x3-5 @ RPE 7, <= 6 exercises", () => {
    const w = generateWorkout(input({ today: TUE, dayType: "workout", phase: "early" }));
    expect(w.decision.session).toBe("full");
    const order = ["A1", "A2", "POWER", "B1", "C1", "C2", "D1", "D2", "MOBILITY", "UPPER"];
    const slots = w.items.map((i) => i.slot);
    expect([...slots].sort((a, b) => order.indexOf(a) - order.indexOf(b))).toEqual(slots);
    const b1 = w.items.find((i) => i.slot === "B1")!;
    expect(b1).toMatchObject({ sets: 3, reps: "3-5" });
    expect(b1.note).toMatch(/RPE 7/);
    checkRules(w, "early");
  });

  it("off-season Full: all 7 slots + 1 UPPER", () => {
    const w = generateWorkout(input({ today: TUE, dayType: "workout", phase: "off" }));
    // Day 1 plyos (up-and-down + skipping, both A1 moves), then every strength slot + 1 UPPER.
    expect(w.items.map((i) => i.slot)).toEqual(["A1", "A1", "B1", "C1", "C2", "D1", "D2", "UPPER"]);
    checkRules(w, "off");
  });

  it("POWER and MOBILITY only appear when turned on", () => {
    const settings = { ...DEFAULT_SETTINGS, enablePower: true, enableMobility: true };
    const w = generateWorkout(input({ today: TUE, dayType: "workout", phase: "off", settings }));
    expect(w.items.map((i) => i.slot)).toContain("POWER");
    expect(w.items.map((i) => i.slot)).toContain("MOBILITY");
  });

  it("half volume halves the sets", () => {
    // Saturday race, early season: 1st hard day (Tue) = Full, 2nd (Thu) = Full at half volume.
    const races = [{ id: "r", date: "2026-09-19", name: "Meet", priority: "B" as const }];
    const full = generateWorkout(input({ today: "2026-09-15", dayType: "workout", phase: "early", races }));
    const half = generateWorkout(input({ today: "2026-09-17", dayType: "workout", phase: "early", races }));
    expect(full.decision.half).toBe(false);
    expect(half.decision.half).toBe(true);
    const total = (w: Workout) => w.items.reduce((s, i) => s + i.sets, 0);
    expect(total(half)).toBeLessThan(total(full));
  });

  it("monster walks (extra lateral volume) only off-season and early season", () => {
    for (let attempt = 0; attempt < 60; attempt++) {
      const w = generateWorkout(input({ today: TUE, dayType: "workout", phase: "deep", attempt }));
      expect(w.items.map((i) => i.exercise.id)).not.toContain("monster-walk");
    }
  });

  it("prefers featured exercises (~70%) when there's no block yet", () => {
    let featured = 0;
    let total = 0;
    for (let d = 1; d <= 28; d++) {
      const today = `2026-09-${String(d).padStart(2, "0")}`;
      const w = generateWorkout(input({ today, dayType: "workout", phase: "off" }));
      for (const i of w.items) {
        total++;
        if (i.exercise.featured) featured++;
      }
    }
    const share = featured / total;
    expect(share).toBeGreaterThan(0.55);
    expect(share).toBeLessThan(0.9);
  });

  it("plyos follow the coach's template: after a Day 1 session comes Day 2 (single-leg + lateral)", () => {
    const history = [
      { id: "x", date: MON, session: "full" as const, volume: "full" as const, exerciseIds: ["drop-jump", "skips-light-tier"], hadStrength: false, hadPlyo: true, plyoTypes: ["deep", "rhythm"] },
    ];
    const w = generateWorkout(input({ today: "2026-09-16", dayType: "workout", phase: "early", history }));
    const plyos = w.items.filter((i) => i.slot === "A1" || i.slot === "A2");
    expect(plyos.map((p) => plyoFamily(p.exercise))).toEqual(["single", "lateral"]);
  });
});

describe("regenerate", () => {
  const cases: [string, Partial<GenerateInput> & { today: string; dayType: RunType; phase: Phase }][] = [
    ["early Full", { today: TUE, dayType: "workout", phase: "early" }],
    ["off-season Full", { today: TUE, dayType: "workout", phase: "off" }],
    ["championship Plyos + Isos", { today: TUE, dayType: "workout", phase: "championship" }],
    ["touch-up", { today: TUE, dayType: "easy", phase: "deep", easyFocus: "touch-up" }],
    ["short", { today: TUE, dayType: "workout", phase: "early", shortOnTime: true }],
  ];

  it.each(cases)("%s: same session type and slot keys, still within the rules", (_, over) => {
    const first = generateWorkout(input(over));
    const seen = new Set(first.items.map((i) => i.exercise.id).join(","));
    for (let attempt = 1; attempt <= 12; attempt++) {
      const w = generateWorkout(input({ ...over, attempt }));
      expect(w.decision.session).toBe(first.decision.session);
      expect(w.items.map((i) => i.key)).toEqual(first.items.map((i) => i.key));
      checkRules(w, over.phase);
      seen.add(w.items.map((i) => i.exercise.id).join(","));
    }
    if (over.shortOnTime === undefined) expect(seen.size).toBeGreaterThan(1); // it actually swaps
  });

  it("block picks come first, then regenerate swaps within the slot", () => {
    const first = generateWorkout(input({ today: TUE, dayType: "workout", phase: "early" }));
    const block = addToBlock(null, TUE, first.items.map((i) => ({ key: i.key, exerciseId: i.exercise.id })));
    // A week later, same picks come back first.
    const later = generateWorkout(input({ today: "2026-09-22", dayType: "workout", phase: "early", block }));
    const b1 = later.items.find((i) => i.slot === "B1")!;
    expect(b1.exercise.id).toBe(first.items.find((i) => i.slot === "B1")!.exercise.id);
    // Regenerate: a different B1, still a B1.
    const regen = generateWorkout(input({ today: "2026-09-22", dayType: "workout", phase: "early", block, attempt: 1 }));
    const b1b = regen.items.find((i) => i.slot === "B1")!;
    expect(b1b.slot).toBe("B1");
    expect(b1b.exercise.id).not.toBe(b1.exercise.id);
  });

  it("block expires after 28 days", () => {
    const block = { startedOn: "2026-08-01", picks: { "full:B1": ["trap-bar-deadlift"] } };
    const ids = new Set<string>();
    for (const today of ["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18"]) {
      const settings = { ...DEFAULT_SETTINGS, workoutDays: [] };
      const w = generateWorkout(input({ today, dayType: "workout", phase: "early", block, settings }));
      ids.add(w.items.find((i) => i.slot === "B1")!.exercise.id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("exercise bank", () => {
  it("every exercise has the fields the engine needs", () => {
    for (const e of ALL_EXERCISES) {
      expect(e.id).toBeTruthy();
      expect(e.name).toBeTruthy();
      expect(e.slot).toBeTruthy();
      expect(Array.isArray(e.session_types)).toBe(true);
    }
    expect(new Set(ALL_EXERCISES.map((e) => e.id)).size).toBe(ALL_EXERCISES.length);
  });

  it("every session type can be filled from the JSON", () => {
    const sessions: [RunType, Phase, Partial<GenerateInput>][] = [
      ["workout", "off", {}],
      ["workout", "early", {}],
      ["workout", "championship", {}],
      ["easy", "deep", {}],
      ["workout", "early", { shortOnTime: true }],
      ["workout", "early", { settings: { ...DEFAULT_SETTINGS, breakStage: "off" } }],
      ["workout", "early", { settings: { ...DEFAULT_SETTINGS, breakStage: "ramp" } }],
    ];
    for (const [dayType, phase, over] of sessions) {
      const w = generateWorkout(input({ today: TUE, dayType, phase, ...over }));
      expect(w.items.length, `${dayType}/${phase}/${w.decision.session}`).toBeGreaterThanOrEqual(2);
    }
    const long = generateWorkout(input({ today: TUE, dayType: "long", phase: "deep" }));
    expect(long.decision.session).toBe("long-isos");
    expect(long.items).toHaveLength(3);
    expect(isCalfAnkle(long.items[0].exercise)).toBe(true);
  });
});
