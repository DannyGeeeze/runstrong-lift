import { describe, expect, it } from "vitest";
import { getExercise } from "@/lib/exercises";
import { bestWeight, formatWeights, isLoaded, lastTime, newBests, suggestWeight } from "@/lib/weights";
import type { LiftLog } from "@/lib/types";

const log = (date: string, weights: LiftLog["weights"]): LiftLog => ({
  id: date,
  date,
  session: "full",
  volume: "full",
  exerciseIds: Object.keys(weights ?? {}),
  hadStrength: true,
  hadPlyo: false,
  plyoTypes: [],
  weights,
});

const history = [log("2026-09-01", { "back-squat": [85, 95, 95] }), log("2026-09-08", { "back-squat": [95, 100, null] })];

describe("weights", () => {
  it("knows which moves are loaded", () => {
    expect(isLoaded(getExercise("back-squat")!)).toBe(true);
    expect(isLoaded(getExercise("pogo")!)).toBe(false);
    // "bodyweight" must not count as a weight.
    expect(isLoaded(getExercise("slalom-leap-ping-tier")!)).toBe(false);
  });

  it("finds last time and best", () => {
    expect(lastTime(history, "back-squat")).toEqual({ date: "2026-09-08", weights: [95, 100] });
    expect(lastTime(history, "rdl")).toBeNull();
    expect(bestWeight(history, "back-squat")).toBe(100);
    expect(formatWeights([95, 100])).toBe("95–100 lb");
    expect(formatWeights([95, 95])).toBe("95 lb");
  });

  it("suggests this session's previous set, else last session's", () => {
    expect(suggestWeight(history, "back-squat", 1)).toBe(95);
    expect(suggestWeight(history, "back-squat", 2)).toBe(100);
    expect(suggestWeight(history, "back-squat", 3)).toBe(100);
    expect(suggestWeight(history, "back-squat", 3, [105, 110])).toBe(110);
    expect(suggestWeight([], "back-squat", 1)).toBeNull();
  });

  it("flags new bests only when they beat a previous logged weight", () => {
    expect(newBests(history, { "back-squat": [105, null] })).toEqual([{ id: "back-squat", weight: 105 }]);
    expect(newBests(history, { "back-squat": [100] })).toEqual([]);
    expect(newBests(history, { rdl: [135] })).toEqual([]);
  });
});
