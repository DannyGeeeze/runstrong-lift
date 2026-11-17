import { describe, expect, it } from "vitest";
import { generateWorkout, toLiftLog, type GenerateInput } from "@/lib/rules";
import { patternFor } from "@/lib/demo/match";
import { ALL_EXERCISES } from "@/lib/exercises";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { Profile } from "@/lib/profile";
import type { EasyFocus, Slot } from "@/lib/types";

const WED = "2026-09-16";

function input(over: Partial<GenerateInput> = {}): GenerateInput {
  return {
    today: WED,
    dayType: "easy",
    phase: "early",
    races: [],
    history: [],
    block: null,
    ...over,
    settings: { ...DEFAULT_SETTINGS, ...(over.settings ?? {}) },
  };
}

const minimal = {
  events: ["xc"], experience: "new", equipment: "minimal", goals: [], troubleSpots: [],
  sessionMinutes: 30, raceDay: "sat", weeklyMiles: 25, name: "",
} as unknown as Profile;

const LEG_SLOTS: Slot[] = ["A1", "A2", "B1", "POWER", "C1"];

describe("easy-day sessions", () => {
  it("defaults to the touch-up", () => {
    expect(generateWorkout(input()).decision.session).toBe("touch-up");
  });

  for (const focus of ["upper", "core", "mobility"] as EasyFocus[]) {
    it(`${focus}: optional, leaves the legs alone, and doesn't count toward the caps`, () => {
      for (const dayType of ["easy", "long"] as const) {
        for (let attempt = 0; attempt < 6; attempt++) {
          const w = generateWorkout(input({ dayType, easyFocus: focus, attempt }));
          expect(w.decision.session).toBe(focus);
          expect(w.decision.optional).toBe(true);
          expect(w.decision.strength).toBe(false);
          expect(w.decision.plyos).toBe(false);
          expect(w.items.length).toBeGreaterThanOrEqual(4);
          const ids = w.items.map((i) => i.exercise.id);
          expect(new Set(ids).size).toBe(ids.length);
          for (const i of w.items) expect(LEG_SLOTS).not.toContain(i.slot);
          expect(w.estMinutes).toBeLessThanOrEqual(25);
          const log = toLiftLog(w, "x");
          expect(log.hadStrength).toBe(false);
          expect(log.hadPlyo).toBe(false);
        }
      }
    });
  }

  it("the pick only applies on easy and long days", () => {
    expect(generateWorkout(input({ dayType: "rest", easyFocus: "upper" })).decision.session).toBe("none");
    expect(generateWorkout(input({ dayType: "workout", easyFocus: "upper" })).decision.session).toBe("full");
  });

  it("upper body has a pull, a push, a shoulder move and a carry or crawl", () => {
    const keys = generateWorkout(input({ easyFocus: "upper" })).items.map((i) => i.key);
    expect(keys).toEqual(["upper:pull", "upper:push", "upper:shoulder", "upper:carry"]);
  });

  it("minimal equipment still gets a full upper-body session without gym gear", () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const w = generateWorkout(input({ easyFocus: "upper", profile: minimal, attempt }));
      expect(w.items.map((i) => i.key)).toContain("upper:pull");
      expect(w.items.map((i) => i.key)).toContain("upper:push");
      for (const i of w.items) expect(i.exercise.equipment ?? "").not.toMatch(/barbell|dumbbell|cable|trap bar|landmine|pull-up bar|TRX/);
    }
  });

  it("mobility works even when mobility is off for Full sessions", () => {
    const w = generateWorkout(input({ easyFocus: "mobility", settings: { ...DEFAULT_SETTINGS, enableMobility: false } }));
    expect(w.items.every((i) => i.slot === "MOBILITY")).toBe(true);
    expect(w.items.length).toBe(5);
  });

  it("return week keeps upper, core and mobility but still swaps the touch-up for isos", () => {
    const settings = { ...DEFAULT_SETTINGS, returnWeek: true };
    expect(generateWorkout(input({ easyFocus: "core", settings })).decision.session).toBe("core");
    expect(generateWorkout(input({ settings })).decision.session).toBe("return");
  });

  it("new moves get fitting animations", () => {
    const id = (x: string) => patternFor(ALL_EXERCISES.find((e) => e.id === x)!).id;
    expect(id("dead-bug")).toBe("dead-bug");
    expect(id("bird-dog")).toBe("bird-dog");
    expect(id("front-plank")).toBe("plank");
    expect(id("push-up")).toBe("push-up");
    expect(id("seated-dumbbell-overhead-press")).toBe("press");
    expect(id("barbell-row")).toBe("row");
    expect(id("side-plank")).toBe("copenhagen");
  });
});
