import { describe, expect, it } from "vitest";
import { generateWorkout, toLiftLog, UPPER_FOCUS_LABEL, UPPER_FOCUSES, type GenerateInput } from "@/lib/rules";
import { patternFor } from "@/lib/demo/match";
import { ALL_EXERCISES } from "@/lib/exercises";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { Profile } from "@/lib/profile";
import type { EasyFocus, LiftLog, Race, Slot, UpperFocus } from "@/lib/types";

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
  it("defaults to an upper-body lift", () => {
    expect(generateWorkout(input()).decision.session).toBe("upper");
    expect(generateWorkout(input({ dayType: "long" })).decision.session).toBe("long-isos");
  });

  for (const focus of ["upper"] as EasyFocus[]) {
    it(`${focus}: optional, leaves the legs alone, and doesn't count toward the caps`, () => {
      for (const dayType of ["easy"] as const) {
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

  it("each body-part day has its own four moves", () => {
    const keys = (upperFocus: UpperFocus) =>
      generateWorkout(input({ easyFocus: "upper", upperFocus })).items.map((i) => i.key);
    expect(keys("back")).toEqual(["upper-back:vertical", "upper-back:row", "upper-back:biceps", "upper-back:rear"]);
    expect(keys("chest")).toEqual(["upper-chest:press", "upper-chest:press2", "upper-chest:triceps", "upper-chest:serratus"]);
    expect(keys("shoulders")).toEqual([
      "upper-shoulders:press", "upper-shoulders:lateral", "upper-shoulders:cuff", "upper-shoulders:stability",
    ]);
  });

  it("every body-part day is short and works with minimal equipment", () => {
    for (const upperFocus of UPPER_FOCUSES) {
      for (let attempt = 0; attempt < 8; attempt++) {
        for (const profile of [undefined, minimal]) {
          const w = generateWorkout(input({ upperFocus, profile, attempt }));
          expect(w.items).toHaveLength(4);
          expect(w.estMinutes).toBeLessThanOrEqual(25);
          expect(w.title).toBe(UPPER_FOCUS_LABEL[upperFocus]);
          if (profile)
            for (const i of w.items)
              expect(i.exercise.equipment ?? "", i.exercise.id).not.toMatch(/barbell|dumbbell|cable|trap bar|landmine|pull-up bar|TRX/);
        }
      }
    }
  });

  it("arm and shoulder add-ons only show up on upper-body days, not in Full sessions", () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const w = generateWorkout(input({ dayType: "workout", phase: "off", attempt }));
      for (const i of w.items.filter((x) => x.slot === "UPPER")) expect(i.exercise.session_types).toContain("full");
    }
  });
  it("week off swaps both easy-day choices for its own optional isos; ramp week leaves them alone", () => {
    const off = { ...DEFAULT_SETTINGS, breakStage: "off" as const };
    expect(generateWorkout(input({ settings: off })).decision.session).toBe("return");
    expect(generateWorkout(input({ easyFocus: "touch-up", settings: off })).decision.session).toBe("return");
    const ramp = { ...DEFAULT_SETTINGS, breakStage: "ramp" as const };
    expect(generateWorkout(input({ settings: ramp })).decision.session).toBe("upper");
  });

  it("new moves get fitting animations", () => {
    const id = (x: string) => patternFor(ALL_EXERCISES.find((e) => e.id === x)!).id;
    expect(id("kb-saw-in-front-plank")).toBe("plank");
    expect(id("push-up")).toBe("push-up");
    expect(id("seated-dumbbell-overhead-press")).toBe("press");
    expect(id("barbell-row")).toBe("row");
    expect(id("dumbbell-curl")).toBe("curl");
    expect(id("band-overhead-triceps-extension")).toBe("triceps-extension");
    expect(id("dumbbell-lateral-raise")).toBe("lateral-raise");
    expect(id("pull-up")).toBe("pull-down");
    expect(id("close-grip-push-up")).toBe("push-up");
  });

  it("upper-body days are dumbbell-only when you have dumbbells: 4 moves each, every body part", () => {
    for (const equipment of ["gym", "home"] as const) {
      const profile = { ...minimal, equipment, experience: "some" } as Profile;
      for (const focus of UPPER_FOCUSES) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const w = generateWorkout(input({ upperFocus: focus, profile, attempt }));
          expect(w.items.length, `${equipment} ${focus} #${attempt}`).toBe(4);
          for (const i of w.items) expect(i.exercise.equipment ?? "", `${focus}: ${i.exercise.id}`).toMatch(/dumbbell/i);
        }
      }
    }
  });

  it("without dumbbells (bodyweight), upper-body days still fill with what you have", () => {
    for (const focus of UPPER_FOCUSES) {
      const w = generateWorkout(input({ upperFocus: focus, profile: minimal }));
      expect(w.items.length, focus).toBeGreaterThanOrEqual(3);
      for (const i of w.items) expect(i.exercise.equipment ?? "").not.toMatch(/dumbbell|barbell|cable/i);
    }
  });

  it("no core or hip-mobility sessions (done at practice)", () => {
    expect(ALL_EXERCISES.some((e) => (e.slot as string) === "CORE")).toBe(false);
  });
});

describe("easy days before an A race", () => {
  const race = (date: string, priority: Race["priority"]): Race => ({ id: date, date, name: "State", distance: "5K", priority });

  it("switches to the touch-up when an A race is within 7 days", () => {
    for (const date of ["2026-09-17", "2026-09-19", "2026-09-23"]) {
      const w = generateWorkout(input({ races: [race(date, "A")] }));
      expect(w.decision.session, date).toBe("touch-up");
      expect(w.decision.why).toMatch(/State \(A\) in \d+ days?, so no upper-body lift/);
    }
  });

  it("keeps upper body when the A race is further out, already past, or only a B/C race", () => {
    expect(generateWorkout(input({ races: [race("2026-09-24", "A")] })).decision.session).toBe("upper");
    expect(generateWorkout(input({ races: [race("2026-09-13", "A")] })).decision.session).toBe("upper");
    expect(generateWorkout(input({ races: [race("2026-09-18", "B"), race("2026-09-19", "C")] })).decision.session).toBe("upper");
  });

  it("the runner can still pick either one", () => {
    expect(generateWorkout(input({ races: [race("2026-09-19", "A")], easyFocus: "upper" })).decision.session).toBe("upper");
    expect(generateWorkout(input({ easyFocus: "touch-up" })).decision.session).toBe("touch-up");
  });
});

describe("upper-body rotation", () => {
  const log = (date: string, upperFocus?: UpperFocus): LiftLog => ({
    id: date, date, session: "upper", volume: "full", exerciseIds: [], hadStrength: false, hadPlyo: false, plyoTypes: [],
    ...(upperFocus ? { upperFocus } : {}),
  });
  const focus = (history: LiftLog[]) => generateWorkout(input({ history })).decision;

  it("starts with back and says it hasn't been done", () => {
    const d = focus([]);
    expect(d.upperFocus).toBe("back");
    expect(d.why).toMatch(/back & biceps is next, not done yet/);
  });

  it("goes to whatever hasn't been done yet, in order", () => {
    expect(focus([log("2026-09-14", "back")]).upperFocus).toBe("chest");
    expect(focus([log("2026-09-14", "chest")]).upperFocus).toBe("back");
    expect(focus([log("2026-09-12", "back"), log("2026-09-14", "chest")]).upperFocus).toBe("shoulders");
  });

  it("once all three are done, picks the one done longest ago", () => {
    const d = focus([log("2026-09-10", "back"), log("2026-09-12", "chest"), log("2026-09-14", "shoulders"), log("2026-09-08", "chest")]);
    expect(d.upperFocus).toBe("back");
    expect(d.why).toMatch(/back & biceps is next, last done 6 days ago/);
  });

  it("ignores today's own log, so the pick doesn't jump after you finish", () => {
    expect(focus([log(WED, "back")]).upperFocus).toBe("back");
  });

  it("the runner can pick a body part, and it's saved with the lift", () => {
    const w = generateWorkout(input({ upperFocus: "shoulders", history: [log("2026-09-14", "back")] }));
    expect(w.decision.upperFocus).toBe("shoulders");
    expect(w.decision.why).not.toMatch(/is next/);
    expect(toLiftLog(w, "x").upperFocus).toBe("shoulders");
  });

  it("touch-up days don't get a body part", () => {
    const w = generateWorkout(input({ easyFocus: "touch-up" }));
    expect(w.decision.upperFocus).toBeUndefined();
    expect(toLiftLog(w, "x").upperFocus).toBeUndefined();
  });
});

describe("long-run days", () => {
  it("a few optional easy holds: 3 isos, 2 x 30 s, no strength or plyos, under 10 min", () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const w = generateWorkout(input({ dayType: "long", attempt }));
      expect(w.decision).toMatchObject({ session: "long-isos", optional: true, strength: false, plyos: false });
      expect(w.title).toBe("Long-run isos");
      expect(w.items).toHaveLength(3);
      for (const i of w.items) {
        expect(i.sets).toBe(2);
        expect(i.reps).toMatch(/^30 s hold/);
      }
      expect(w.estMinutes).toBeLessThanOrEqual(10);
      expect(toLiftLog(w, "x")).toMatchObject({ hadStrength: false, hadPlyo: false });
    }
  });

  it("ignores the easy-day pick and the A-race touch-up switch", () => {
    expect(generateWorkout(input({ dayType: "long", easyFocus: "upper" })).decision.session).toBe("long-isos");
    const races: Race[] = [{ id: "a", date: "2026-09-19", name: "State", priority: "A" }];
    expect(generateWorkout(input({ dayType: "long", races })).decision.session).toBe("long-isos");
  });
});
