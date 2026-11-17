import { describe, expect, it } from "vitest";
import { buildSteps, restSeconds, workSeconds } from "@/lib/live";
import { generateWorkout } from "@/lib/rules";
import { DEFAULT_SETTINGS } from "@/lib/storage";

const TUE = "2026-09-15";
const base = { today: TUE, races: [], history: [], block: null, settings: DEFAULT_SETTINGS };

describe("live workout timing", () => {
  it("parses timed reps", () => {
    expect(workSeconds("3-5 s max push")).toBe(5);
    expect(workSeconds("3-5 s max push/side")).toBe(5);
    expect(workSeconds("20-45 s hold")).toBe(30);
    expect(workSeconds("30 s/side")).toBe(30);
    expect(workSeconds("3-5")).toBeNull();
    expect(workSeconds("20-30 m")).toBeNull();
    expect(workSeconds("8/side")).toBeNull();
  });

  it("parses rest", () => {
    expect(restSeconds("2-3 min")).toBe(150);
    expect(restSeconds("60-90 s")).toBe(75);
    expect(restSeconds("20 s between reps, 60 s between sets")).toBe(60);
    expect(restSeconds("superset, then 2 min")).toBe(120);
    expect(restSeconds("straight back to squat")).toBe(0);
    expect(restSeconds("walk back")).toBe(45);
    expect(restSeconds("15-20 s between pushes")).toBe(20);
  });

  it("walks every set of every exercise, with rests between and none at the end", () => {
    const w = generateWorkout({ ...base, dayType: "workout", phase: "early" });
    const steps = buildSteps(w.items, w.warmup);
    expect(steps[0].kind).toBe("warmup");
    expect(steps.at(-1)!.kind).toBe("work");
    for (const [i, item] of w.items.entries()) {
      const sets = new Set(steps.filter((s) => s.kind === "work" && s.item === i).map((s) => s.kind === "work" && s.set));
      expect(sets.size).toBe(item.sets);
    }
    // No two rests in a row.
    steps.forEach((s, i) => {
      if (s.kind === "rest") expect(steps[i + 1]?.kind).toBe("work");
    });
  });

  it("supersets alternate exercises and rest only after the pair", () => {
    const w = generateWorkout({ ...base, dayType: "workout", phase: "early", shortOnTime: true });
    const steps = buildSteps(w.items, []);
    const b1 = w.items.findIndex((i) => i.slot === "B1");
    const c2 = w.items.findIndex((i) => i.slot === "C2");
    const firstB1 = steps.findIndex((s) => s.kind === "work" && s.item === b1);
    expect(steps[firstB1 + 1]).toMatchObject({ kind: "work", item: c2, set: 1 });
    expect(steps[firstB1 + 2]).toMatchObject({ kind: "rest", seconds: 120 });
    expect(steps[firstB1 + 3]).toMatchObject({ kind: "work", item: b1, set: 2 });
  });

  it("timed holds count down, one side at a time when needed", () => {
    const w = generateWorkout({ ...base, dayType: "workout", phase: "championship" });
    const steps = buildSteps(w.items, []);
    const timed = steps.filter((s) => s.kind === "work" && s.seconds !== null);
    expect(timed.length).toBeGreaterThan(0);
    const sided = steps.findIndex((s) => s.kind === "work" && s.side === "left");
    if (sided >= 0) {
      expect(steps[sided + 1]).toMatchObject({ kind: "rest", label: "Switch sides" });
      expect(steps[sided + 2]).toMatchObject({ kind: "work", side: "right" });
    }
  });
});
