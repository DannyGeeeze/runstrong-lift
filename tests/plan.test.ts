import { describe, expect, it } from "vitest";
import { planDays } from "@/lib/plan";
import type { GenerateInput } from "@/lib/rules";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { Race } from "@/lib/types";

// Mon 2026-09-14. Default workout days: Tue + Fri.
const MON = "2026-09-14";
const satRace: Race = { id: "r", date: "2026-09-19", name: "Invitational", priority: "B" };

function input(over: Partial<GenerateInput> = {}): Omit<GenerateInput, "attempt" | "decision"> {
  return {
    today: MON,
    dayType: "easy",
    phase: "early",
    races: [],
    history: [],
    block: null,
    ...over,
    settings: { ...DEFAULT_SETTINGS, ...(over.settings ?? {}) },
  };
}

describe("week plan", () => {
  it("plans 7 days starting today", () => {
    const plan = planDays(input(), {});
    expect(plan).toHaveLength(7);
    expect(plan[0]).toMatchObject({ date: MON, source: "today", type: "easy" });
    expect(plan[6].date).toBe("2026-09-20");
  });

  it("guesses each day's run: your override, then a race, then a workout day, then easy", () => {
    const plan = planDays(input({ races: [satRace] }), { "2026-09-17": "long" });
    const by = Object.fromEntries(plan.map((d) => [d.date, d]));
    expect(by["2026-09-17"]).toMatchObject({ type: "long", source: "override" });
    expect(by["2026-09-19"]).toMatchObject({ type: "race", source: "race" });
    // A Saturday race: the 1st and 2nd workouts before it (Tue and Thu).
    expect(by["2026-09-15"]).toMatchObject({ type: "workout", source: "planned" });
    expect(by["2026-09-16"]).toMatchObject({ type: "easy", source: "assumed" });
  });

  it("never plans a lift on race day", () => {
    const plan = planDays(input({ races: [satRace] }), {});
    expect(plan.find((d) => d.date === "2026-09-19")!.workout.decision.session).toBe("none");
  });

  it("treats each planned lift as done, so the upper-body rotation moves through the week", () => {
    // No races: Tue/Fri are workouts, the rest easy days with upper body.
    const plan = planDays(input(), {});
    const uppers = plan.filter((d) => d.workout.decision.session === "upper").map((d) => d.workout.decision.upperFocus);
    expect(uppers.slice(0, 3)).toEqual(["back", "chest", "shoulders"]);
  });

  it("weekly caps carry across planned days", () => {
    // Two strength sessions already in the last 7 days: Tuesday's planned workout can't add strength.
    const done = (date: string) => ({ id: date, date, session: "full" as const, volume: "full" as const, exerciseIds: [], hadStrength: true, hadPlyo: true, plyoTypes: [] });
    const plan = planDays(input({ history: [done("2026-09-10"), done("2026-09-12")] }), {});
    const tue = plan.find((d) => d.date === "2026-09-15")!;
    expect(tue.workout.decision.strength).toBe(false);
  });

  it("week off: optional holds every other day", () => {
    const plan = planDays(input({ settings: { ...DEFAULT_SETTINGS, breakStage: "off", breakStageSince: MON } }), {});
    expect(plan.map((d) => d.workout.decision.session)).toEqual(["return", "none", "return", "none", "return", "none", "return"]);
  });

  it("only today uses today's picks (easy-day choice)", () => {
    const plan = planDays(input({ easyFocus: "touch-up" }), {});
    expect(plan[0].workout.decision.session).toBe("touch-up");
    expect(plan[2].workout.decision.session).toBe("upper");
  });
});
