import { describe, expect, it } from "vitest";
import { isCalfAnkle, isoKind, isPlyo } from "@/lib/exercises";
import type { Profile } from "@/lib/profile";
import { generateWorkout, volumeTier, weeklyMilesFor, type GenerateInput } from "@/lib/rules";
import { DEFAULT_SETTINGS } from "@/lib/storage";

const TUE = "2026-09-15";

const profile = (over: Partial<Profile> = {}): Profile =>
  ({
    name: "",
    events: ["distance"],
    weeklyMiles: 40,
    experience: "some",
    equipment: "gym",
    goals: [],
    troubleSpots: [],
    sessionMinutes: 45,
    raceDay: "thu",
    ...over,
  }) as Profile;

function input(over: Partial<GenerateInput> = {}): GenerateInput {
  return {
    today: TUE,
    dayType: "workout",
    phase: "early",
    races: [],
    history: [],
    block: null,
    profile: profile(),
    ...over,
    settings: { ...DEFAULT_SETTINGS, ...(over.settings ?? {}) },
  };
}
const miles = (m: number) => ({ miles: m, source: "runs" as const });
const loaded = (w: ReturnType<typeof generateWorkout>) => w.items.filter((i) => !isoKind(i.exercise));

describe("session size follows weekly mileage", () => {
  it("tiers: under 20 base, 20-34 build, 35 and up full", () => {
    expect(volumeTier(0)).toBe("base");
    expect(volumeTier(19.9)).toBe("base");
    expect(volumeTier(20)).toBe("build");
    expect(volumeTier(34.9)).toBe("build");
    expect(volumeTier(35)).toBe("full");
    expect(volumeTier(90)).toBe("full");
  });

  it("never goes down at high mileage: 35, 50 and 80 mi/week are the full session", () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const plain = generateWorkout(input({ attempt }));
      for (const m of [35, 50, 80]) {
        const w = generateWorkout(input({ attempt, weeklyMiles: miles(m) }));
        expect(w.items.map((i) => [i.exercise.id, i.sets, i.reps]), `${m} mi`).toEqual(plain.items.map((i) => [i.exercise.id, i.sets, i.reps]));
        expect(w.volume).toBeUndefined();
      }
    }
  });

  it("under 20 mi/week: 2 sets of every loaded move, with a note", () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const w = generateWorkout(input({ attempt, weeklyMiles: miles(15) }));
      expect(w.decision.session).toBe("full");
      for (const i of loaded(w)) expect(i.sets, i.exercise.id).toBeLessThanOrEqual(2);
      expect(w.volume).toMatchObject({ tier: "base", miles: 15 });
      expect(w.volume?.note).toMatch(/grow as your mileage builds/);
    }
  });

  it("20-34 mi/week: the main lift keeps 3 sets, the rest 2", () => {
    const w = generateWorkout(input({ weeklyMiles: miles(28) }));
    const main = w.items.find((i) => i.slot === "B1")!;
    expect(main.sets).toBe(3);
    for (const i of loaded(w).filter((x) => x.slot !== "B1")) expect(i.sets).toBeLessThanOrEqual(2);
    expect(w.volume?.tier).toBe("build");
  });

  it("only Full sessions change; mileage unknown means full", () => {
    const pi = (m?: number) => generateWorkout(input({ phase: "championship", weeklyMiles: m === undefined ? null : miles(m) }));
    expect(pi(10).items.map((i) => i.sets)).toEqual(pi().items.map((i) => i.sets));
    expect(pi(10).volume).toBeUndefined();
    expect(generateWorkout(input({ weeklyMiles: null })).volume).toBeUndefined();
  });

  it("uses the last 7 days of runs when there are any, otherwise the setup answer", () => {
    expect(weeklyMilesFor(42.3, 6, 30)).toEqual({ miles: 42.3, source: "runs" });
    expect(weeklyMilesFor(0, 0, 30)).toEqual({ miles: 30, source: "profile" });
    expect(weeklyMilesFor(0, 0, undefined)).toBeNull();
  });
});

describe("event emphasis", () => {
  // A lateral plyo already done this week, so the "lateral is due" rule doesn't add a 2nd plyo by itself.
  const lateralDone = [
    { id: "x", date: "2026-09-14", session: "plyos-isos" as const, volume: "full" as const, exerciseIds: [], hadStrength: false, hadPlyo: true, plyoTypes: ["lateral"] },
  ];
  it("800 / mile runners get 2 plyos in every Full session", () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const w = generateWorkout(input({ attempt, history: lateralDone, profile: profile({ events: ["mid"] }) }));
      expect(w.items.filter((i) => isPlyo(i.exercise)).length, `attempt ${attempt}`).toBe(2);
    }
  });

  it("cross country and road runners: the calf move is an Achilles/calf hold", () => {
    for (const events of [["xc"], ["long"]] as Profile["events"][]) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const w = generateWorkout(input({ attempt, profile: profile({ events }) }));
        const calf = w.items.find((i) => i.slot === "C2")!;
        expect(isoKind(calf.exercise), `${events[0]} attempt ${attempt}: ${calf.exercise.id}`).toBeTruthy();
        expect(isCalfAnkle(calf.exercise)).toBe(true);
      }
    }
  });

  it("1600 / 3200 keeps the default", () => {
    const w = generateWorkout(input({ history: lateralDone, profile: profile({ events: ["distance"] }) }));
    expect(w.items.filter((i) => isPlyo(i.exercise)).length).toBe(1);
  });
});
