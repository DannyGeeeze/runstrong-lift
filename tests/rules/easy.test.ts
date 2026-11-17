import { describe, expect, it } from "vitest";
import { generateWorkout, suggestEasyFocus, toLiftLog, weekCounts, type GenerateInput } from "@/lib/rules";
import { patternFor } from "@/lib/demo/match";
import { ALL_EXERCISES } from "@/lib/exercises";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { Profile } from "@/lib/profile";
import type { EasyFocus, LiftLog, Slot } from "@/lib/types";

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

  for (const focus of ["upper"] as EasyFocus[]) {
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

  it("return week keeps upper body but still swaps the touch-up for isos", () => {
    const settings = { ...DEFAULT_SETTINGS, returnWeek: true };
    expect(generateWorkout(input({ easyFocus: "upper", settings })).decision.session).toBe("upper");
    expect(generateWorkout(input({ settings })).decision.session).toBe("return");
  });

  it("new moves get fitting animations", () => {
    const id = (x: string) => patternFor(ALL_EXERCISES.find((e) => e.id === x)!).id;
    expect(id("kb-saw-in-front-plank")).toBe("plank");
    expect(id("push-up")).toBe("push-up");
    expect(id("seated-dumbbell-overhead-press")).toBe("press");
    expect(id("barbell-row")).toBe("row");
  });

  it("no core or hip-mobility sessions (done at practice)", () => {
    expect(ALL_EXERCISES.some((e) => (e.slot as string) === "CORE")).toBe(false);
  });
});

describe("easy-day suggestion over the week", () => {
  const log = (date: string, session: LiftLog["session"]): LiftLog => ({
    id: date + session, date, session, volume: "full", exerciseIds: [], hadStrength: false, hadPlyo: false, plyoTypes: [],
  });

  it("starts on the touch-up with no history", () => {
    expect(suggestEasyFocus([], WED)).toBe("touch-up");
  });

  it("after a touch-up this week, suggests upper body, and the reverse", () => {
    expect(suggestEasyFocus([log("2026-09-14", "touch-up")], WED)).toBe("upper");
    expect(suggestEasyFocus([log("2026-09-14", "upper")], WED)).toBe("touch-up");
  });

  it("ignores easy sessions more than 7 days ago", () => {
    expect(suggestEasyFocus([log("2026-09-09", "touch-up")], WED)).toBe("touch-up");
  });

  it("when both are done, suggests the one done longer ago", () => {
    expect(suggestEasyFocus([log("2026-09-11", "upper"), log("2026-09-14", "touch-up")], WED)).toBe("upper");
    expect(suggestEasyFocus([log("2026-09-14", "upper"), log("2026-09-11", "touch-up")], WED)).toBe("touch-up");
  });

  it("the Week page counts easy sessions from the last 7 days", () => {
    const counts = weekCounts([log("2026-09-14", "upper"), log("2026-09-01", "touch-up"), log("2026-09-15", "full")], WED);
    expect(counts.easy).toEqual(["upper"]);
  });
});
