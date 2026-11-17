import { describe, expect, it } from "vitest";
import { generateWorkout, type GenerateInput } from "@/lib/rules";
import { hasEquipment, matchesFocus, type Profile } from "@/lib/profile";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { Exercise, Phase, RunType } from "@/lib/types";

const TUE = "2026-09-15";

const BASE: Profile = {
  name: "",
  events: ["xc", "distance"],
  weeklyMiles: 55,
  experience: "solid",
  equipment: "gym",
  goals: [],
  troubleSpots: [],
  sessionMinutes: 45,
  raceDay: "thu",
  completedAt: "2026-09-01",
};

function input(profile: Partial<Profile>, over: Partial<GenerateInput> & { dayType?: RunType; phase?: Phase } = {}): GenerateInput {
  return {
    today: TUE,
    dayType: "workout",
    phase: "early",
    races: [],
    history: [],
    block: null,
    ...over,
    settings: { ...DEFAULT_SETTINGS, ...(over.settings ?? {}) },
    profile: { ...BASE, ...profile },
  };
}

/** Run many regenerates so the check covers the whole candidate list, not one pick. */
function allPicks(i: GenerateInput, attempts = 25) {
  return Array.from({ length: attempts }, (_, attempt) => generateWorkout({ ...i, attempt })).flatMap((w) => w.items);
}

describe("equipment", () => {
  it("parses combined and alternative equipment", () => {
    const ex = (equipment: string) => ({ id: "x", name: "x", slot: "C1", session_types: [], equipment }) as Exercise;
    expect(hasEquipment(ex("dumbbells, slider"), "home")).toBe(true);
    expect(hasEquipment(ex("barbell"), "home")).toBe(false);
    expect(hasEquipment(ex("cable or band"), "minimal")).toBe(true);
    expect(hasEquipment(ex("barbell"), "gym")).toBe(true);
  });

  it("home and minimal setups never get barbell, rack or machine moves", () => {
    for (const equipment of ["home", "minimal"] as const) {
      for (const phase of ["off", "early"] as const) {
        const items = allPicks(input({ equipment }, { phase }));
        for (const i of items) expect(hasEquipment(i.exercise, equipment), `${equipment}: ${i.exercise.name} (${i.exercise.equipment})`).toBe(true);
      }
    }
  });

  it("still fills every slot with only bodyweight", () => {
    const w = generateWorkout(input({ equipment: "minimal" }, { phase: "off" }));
    expect(w.items.map((i) => i.slot)).toEqual(["A1", "A2", "B1", "C1", "C2", "D1", "D2", "UPPER"]);
  });
});

describe("experience", () => {
  it("new lifters skip high-intensity moves and Nordics in Full sessions", () => {
    const items = allPicks(input({ experience: "new" }));
    for (const i of items) {
      expect(i.exercise.intensity).not.toBe("high");
      expect(i.exercise.id).not.toMatch(/nordic/);
    }
  });

  it("new lifters get a gentler Short session", () => {
    const w = generateWorkout({ ...input({ experience: "new" }), shortOnTime: true });
    expect(w.decision.session).toBe("short");
    expect(w.items.map((i) => i.slot)).toEqual(["A1", "B1", "C2", "C1"]);
    for (const i of w.items) expect(i.exercise.intensity).not.toBe("high");
  });

  it("solid lifters can get the heavy stuff", () => {
    const items = allPicks(input({ experience: "solid" }));
    expect(items.some((i) => i.exercise.intensity === "high")).toBe(true);
  });
});

describe("goals", () => {
  it("faster kick / efficiency → 2 plyos in-season, still max 6 moves", () => {
    for (const goal of ["kick", "economy"] as const) {
      // Lateral already done this week, so A2 is only there because of the goal.
      const history = [{ id: "h", date: "2026-09-14", session: "full" as const, volume: "full" as const, exerciseIds: [], hadStrength: false, hadPlyo: true, plyoTypes: ["lateral"] }];
      const w = generateWorkout(input({ goals: [goal] }, { history }));
      const slots = w.items.map((i) => i.slot);
      expect(slots.slice(0, 2)).toEqual(["A1", "A2"]);
      expect(slots.length).toBeLessThanOrEqual(6);
    }
  });

  it("without a plyo goal, one plyo when lateral is already done", () => {
    const history = [{ id: "h", date: "2026-09-14", session: "full" as const, volume: "full" as const, exerciseIds: [], hadStrength: false, hadPlyo: true, plyoTypes: ["lateral"] }];
    const w = generateWorkout(input({ goals: ["healthy"] }, { history }));
    expect(w.items.filter((i) => i.slot === "A1" || i.slot === "A2")).toHaveLength(1);
  });
});

describe("trouble spots", () => {
  it("puts exercises for the runner's trouble spots first in their slot", () => {
    const w = generateWorkout(input({ troubleSpots: ["shins"] }, { dayType: "easy", easyFocus: "touch-up" }));
    // Touch-up: foot/calf slots should lead with shin work.
    expect(w.items.some((i) => matchesFocus(i.exercise, ["shins"]))).toBe(true);
  });

  it("hips focus shows up in Full sessions", () => {
    const w = generateWorkout(input({ troubleSpots: ["hips"] }));
    const d = w.items.filter((i) => i.slot === "D1" || i.slot === "D2");
    expect(d.every((i) => matchesFocus(i.exercise, ["hips"]))).toBe(true);
  });
});
