import { describe, expect, it } from "vitest";
import { isCalfAnkle, isoKind, isPlyo } from "@/lib/exercises";
import {
  BREAK_STAGE_DAYS,
  decideCatchUp,
  generateWorkout,
  suggestBreakStage,
  type GenerateInput,
} from "@/lib/rules";
import { DEFAULT_SETTINGS, normalizeSettings } from "@/lib/storage";
import type { BreakStage, LiftLog, Race, RunType } from "@/lib/types";

// Week of Mon 2026-09-14; Thursday 09-17 is a meet.
const MON = "2026-09-14";
const TUE = "2026-09-15";
const WED = "2026-09-16";
const THU = "2026-09-17";
const FRI = "2026-09-18";
const thuRace: Race = { id: "r1", date: THU, name: "Dual meet", priority: "B" };

function input(stage: BreakStage, over: Partial<GenerateInput> = {}): GenerateInput {
  return {
    today: TUE,
    dayType: "workout",
    phase: "deep",
    races: [],
    history: [],
    block: null,
    ...over,
    settings: { ...DEFAULT_SETTINGS, breakStage: stage, breakStageSince: stage === "normal" ? "" : MON, ...(over.settings ?? {}) },
  };
}

function lift(date: string, session: LiftLog["session"] = "return", strength = false): LiftLog {
  return { id: date + session, date, session, volume: "full", exerciseIds: [], hadStrength: strength, hadPlyo: false, plyoTypes: [] };
}

const HIP_HAM = ["C1", "D1", "D2"];

describe("break stage: Week off", () => {
  it("offers one optional session on any non-race day, ignoring the hard-day rule", () => {
    for (const dayType of ["workout", "easy", "long", "rest"] as RunType[]) {
      const w = generateWorkout(input("off", { dayType }));
      expect(w.decision, dayType).toMatchObject({ session: "return", optional: true, strength: false, plyos: false });
      expect(w.decision.why).toMatch(/^Week off: optional yielding isos/);
    }
  });

  it("is yielding isos only: 20-45 s holds, 2-3 sets, one Achilles/calf and one hip/hamstring, about 15 min", () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const w = generateWorkout(input("off", { attempt }));
      expect(w.title).toBe("Week-off isos");
      expect(w.items.length).toBe(3);
      for (const i of w.items) {
        expect(["yielding", "hold"]).toContain(isoKind(i.exercise));
        expect(isPlyo(i.exercise)).toBe(false);
        expect(i.reps).toMatch(/^20-45 s hold/);
        expect(i.sets).toBeGreaterThanOrEqual(2);
        expect(i.sets).toBeLessThanOrEqual(3);
      }
      expect(w.items.some((i) => isCalfAnkle(i.exercise)), `attempt ${attempt}: calf/Achilles`).toBe(true);
      expect(w.items.some((i) => HIP_HAM.includes(i.exercise.slot)), `attempt ${attempt}: hip/hamstring`).toBe(true);
      expect(w.estMinutes).toBeGreaterThanOrEqual(10);
      expect(w.estMinutes).toBeLessThanOrEqual(20);
    }
  });

  it("spaces sessions every 2-3 days: rest the day after one", () => {
    const dayAfter = generateWorkout(input("off", { today: WED, history: [lift(TUE)] }));
    expect(dayAfter.decision.session).toBe("none");
    expect(dayAfter.decision.why).toMatch(/rest today \(last session yesterday\), next optional session tomorrow/);
    expect(generateWorkout(input("off", { today: THU, races: [], history: [lift(TUE)] })).decision.session).toBe("return");
    expect(generateWorkout(input("off", { today: FRI, history: [lift(TUE)] })).decision.session).toBe("return");
  });

  it("ignores the 48h rule and the weekly caps", () => {
    // Normally: workout the day before a race = no strength; 2 strength sessions already = capped.
    const busy = [lift(MON, "full", true), lift("2026-09-11", "full", true)];
    const w = generateWorkout(input("off", { today: WED, races: [thuRace], history: busy }));
    expect(w.decision.session).toBe("return");
    expect(w.decision.nextHard).toBeNull();
  });

  it("still never lifts on a race day, and has no next-morning catch-up", () => {
    expect(generateWorkout(input("off", { today: THU, dayType: "race", races: [thuRace] })).decision.session).toBe("none");
    expect(decideCatchUp(input("off", { today: FRI, dayType: "easy" }), "workout")).toBeNull();
  });
});

describe("break stage: Ramp week", () => {
  it("Full sessions at lighter loads: loaded moves 2-3 x 8-12 @ RPE 5-6", () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const w = generateWorkout(input("ramp", { attempt }));
      expect(w.decision).toMatchObject({ session: "full", ramp: true, strength: true });
      expect(w.title).toBe("Ramp-week strength");
      expect(w.decision.why).toMatch(/ramp week: lighter loads/);
      const loaded = w.items.filter((i) => !isPlyo(i.exercise) && !isoKind(i.exercise));
      expect(loaded.length).toBeGreaterThan(0);
      for (const i of loaded) {
        expect(i.sets).toBeGreaterThanOrEqual(2);
        expect(i.sets).toBeLessThanOrEqual(3);
        expect(i.reps).toMatch(/^8-12(\/side)?$/);
        expect(i.note).toMatch(/RPE 5-6/);
      }
    }
  });

  it("keeps plyos to low/medium and drops every high-intensity move (no Nordics)", () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      const w = generateWorkout(input("ramp", { attempt, phase: "off" }));
      expect(w.items.some((i) => isPlyo(i.exercise))).toBe(true);
      for (const i of w.items) {
        expect(i.exercise.intensity, i.exercise.id).not.toBe("high");
        expect(i.exercise.id).not.toMatch(/nordic/);
      }
    }
  });

  it("uses the normal hard-day timing: 48h rule, race days, easy days", () => {
    // Workout the day before a meet: under 48h, so no strength (and no ramp dosing needed).
    const wed = generateWorkout(input("ramp", { today: WED, races: [thuRace] }));
    expect(wed.decision.session).toBe("plyos-isos");
    expect(wed.decision.ramp).toBeUndefined();
    expect(wed.decision.why).toMatch(/under 48h/);
    // Race day: no lift. Easy day: the usual upper-body option.
    expect(generateWorkout(input("ramp", { today: THU, dayType: "race", races: [thuRace] })).decision.session).toBe("none");
    expect(generateWorkout(input("ramp", { dayType: "easy" })).decision.session).toBe("upper");
    // Weekly cap still applies.
    const capped = generateWorkout(input("ramp", { history: [lift(MON, "full", true), lift("2026-09-10", "full", true)] }));
    expect(capped.decision.strength).toBe(false);
  });

  it("short on time gives a Short session with the same lighter dosing", () => {
    const w = generateWorkout(input("ramp", { shortOnTime: true }));
    expect(w.decision).toMatchObject({ session: "short", ramp: true });
    for (const i of w.items.filter((x) => !isPlyo(x.exercise) && !isoKind(x.exercise))) expect(i.reps).toMatch(/^8-12/);
  });
});

describe("break stage: Normal", () => {
  it("runs the regular rules: Full with the main lift at 3 x 3-5 @ RPE 7", () => {
    const w = generateWorkout(input("normal"));
    expect(w.decision.session).toBe("full");
    expect(w.decision.ramp).toBeUndefined();
    expect(w.title).toBe("Full strength");
    const main = w.items.find((i) => i.slot === "B1");
    expect(main).toMatchObject({ sets: 3, reps: "3-5" });
    expect(generateWorkout(input("normal", { today: WED, races: [thuRace] })).decision.session).toBe("plyos-isos");
  });
});

describe("break stage: moving on", () => {
  const at = (stage: BreakStage, since: string, today: string) => suggestBreakStage({ breakStage: stage, breakStageSince: since }, today);

  it(`suggests the next stage after ${BREAK_STAGE_DAYS} days, never before`, () => {
    expect(at("off", MON, "2026-09-20")).toBeNull(); // day 6
    expect(at("off", MON, "2026-09-21")).toMatchObject({ next: "ramp", days: 7 });
    expect(at("ramp", MON, "2026-09-21")).toMatchObject({ next: "normal", days: 7 });
    expect(at("ramp", MON, "2026-09-25")?.message).toMatch(/11 days into your ramp week/);
  });

  it("has nothing to suggest in Normal or without a start date", () => {
    expect(at("normal", "", "2026-12-01")).toBeNull();
    expect(at("off", "", "2026-12-01")).toBeNull();
  });

  it("only suggests: the stage doesn't change by itself", () => {
    const w = generateWorkout(input("off", { today: "2026-09-30" }));
    expect(w.decision.session).toBe("return");
  });

  it("carries the old Return week toggle over as Week off", () => {
    const migrated = normalizeSettings({ phase: "deep", tuneUpDay: "mon", returnWeek: true });
    expect(migrated.breakStage).toBe("off");
    expect(migrated.breakStageSince).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(normalizeSettings({ phase: "deep", returnWeek: false }).breakStage).toBe("normal");
    expect(normalizeSettings({ breakStage: "ramp", breakStageSince: MON, returnWeek: true })).toMatchObject({ breakStage: "ramp", breakStageSince: MON });
    expect("returnWeek" in normalizeSettings({ returnWeek: true })).toBe(false);
  });
});
