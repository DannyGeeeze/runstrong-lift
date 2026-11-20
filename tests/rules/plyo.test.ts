import { describe, expect, it } from "vitest";
import { getExercise, isPlyo } from "@/lib/exercises";
import { planDays } from "@/lib/plan";
import { generateWorkout, nextPlyoDay, plyoFamily, plyoReps, type GenerateInput } from "@/lib/rules";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { LiftLog } from "@/lib/types";

const TUE = "2026-09-15";

function input(over: Partial<GenerateInput> = {}): GenerateInput {
  return {
    today: TUE,
    dayType: "workout",
    phase: "early",
    races: [],
    history: [],
    block: null,
    ...over,
    settings: { ...DEFAULT_SETTINGS, ...(over.settings ?? {}) },
  };
}
const fam = (id: string) => plyoFamily(getExercise(id)!);
const log = (date: string, exerciseIds: string[]): LiftLog => ({
  id: date, date, session: "full", volume: "full", exerciseIds, hadStrength: true, hadPlyo: true, plyoTypes: [],
});
const plyosOf = (w: ReturnType<typeof generateWorkout>) => w.items.filter((i) => isPlyo(i.exercise));

describe("the coach's plyo template", () => {
  it("sorts plyos into the template's four kinds of move", () => {
    expect(fam("drop-jump")).toBe("updown");
    expect(fam("pogo")).toBe("updown");
    expect(fam("depth-jump-12in-to-16in-box")).toBe("updown");
    expect(fam("skips-light-tier")).toBe("skip");
    expect(fam("single-leg-pogo")).toBe("single");
    expect(fam("sl-hop")).toBe("single");
    expect(fam("split-exchange-pogo")).toBe("single");
    expect(fam("skater-bound")).toBe("lateral");
    expect(fam("slalom-jump")).toBe("lateral");
  });

  it("alternates Day 1 and Day 2, starting with Day 1", () => {
    expect(nextPlyoDay([], TUE)).toBe(1);
    expect(nextPlyoDay([log("2026-09-12", ["drop-jump", "skips-light-tier"])], TUE)).toBe(2);
    expect(nextPlyoDay([log("2026-09-12", ["single-leg-pogo", "skater-bound"])], TUE)).toBe(1);
    // A session already logged today doesn't flip today's day.
    expect(nextPlyoDay([log(TUE, ["drop-jump", "skips-light-tier"])], TUE)).toBe(1);
  });

  it("every Full session: exactly 2 plyo moves from the day, 2-3 sets, in contacts or meters", () => {
    for (let attempt = 0; attempt < 6; attempt++) {
      const d1 = plyosOf(generateWorkout(input({ attempt })));
      expect(d1.map((p) => plyoFamily(p.exercise)), `day 1 #${attempt}`).toEqual(["updown", "skip"]);
      const d2 = plyosOf(generateWorkout(input({ attempt, history: [log("2026-09-12", ["drop-jump", "skips-light-tier"])] })));
      expect(d2.map((p) => plyoFamily(p.exercise)), `day 2 #${attempt}`).toEqual(["single", "lateral"]);
      for (const p of [...d1, ...d2]) {
        expect(p.sets).toBeGreaterThanOrEqual(2);
        expect(p.sets).toBeLessThanOrEqual(3);
        expect(p.reps, p.exercise.id).toMatch(/contacts|\bm\b|\d m/);
      }
    }
  });

  it("Plyos + Isos and Short sessions use the same 2-move template", () => {
    const pi = plyosOf(generateWorkout(input({ phase: "championship" })));
    expect(pi.map((p) => plyoFamily(p.exercise))).toEqual(["updown", "skip"]);
    for (const p of pi) expect(p.exercise.intensity).not.toBe("high");
    const short = generateWorkout(input({ shortOnTime: true }));
    expect(short.decision.session).toBe("short");
    expect(plyosOf(short).map((p) => [plyoFamily(p.exercise), p.sets])).toEqual([["updown", 2], ["skip", 2]]);
  });

  it("in season a Full session is still at most 6 moves, the 2 plyos included", () => {
    for (const phase of ["early", "deep"] as const) {
      const w = generateWorkout(input({ phase, settings: { ...DEFAULT_SETTINGS, enablePower: true, enableMobility: true } }));
      expect(w.items.length, phase).toBeLessThanOrEqual(6);
      expect(plyosOf(w)).toHaveLength(2);
    }
  });

  it("across a planned week the plyo days alternate", () => {
    const plan = planDays({ ...input(), today: "2026-09-14", dayType: "easy" }, {});
    const days = plan
      .map((d) => plyosOf(d.workout).map((p) => plyoFamily(p.exercise)))
      .filter((f) => f.length > 0);
    expect(days.length).toBeGreaterThanOrEqual(2);
    expect(days[0]).toEqual(["updown", "skip"]);
    expect(days[1]).toEqual(["single", "lateral"]);
  });

  it("counts reps as contacts; meters stay meters", () => {
    expect(plyoReps("3-5")).toBe("3-5 contacts");
    expect(plyoReps("6/side")).toBe("6 contacts/side");
    expect(plyoReps("20 contacts")).toBe("20 contacts");
    expect(plyoReps("50-60 m")).toBe("50-60 m");
  });
});
