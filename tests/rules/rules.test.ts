import { describe, expect, it } from "vitest";
import {
  decideCatchUp,
  decideSession,
  generateWorkout,
  hardDays,
  suggestPhase,
  type GenerateInput,
  type RuleContext,
} from "@/lib/rules";
import { DEFAULT_SETTINGS } from "@/lib/storage";
import type { LiftLog, Phase, Race, RunType } from "@/lib/types";

// Week of Mon 2026-09-14. Thursday = 09-17, Saturday = 09-19.
const MON = "2026-09-14";
const TUE = "2026-09-15";
const WED = "2026-09-16";
const THU = "2026-09-17";
const FRI = "2026-09-18";
const SAT = "2026-09-19";

const thuRace: Race = { id: "r1", date: THU, name: "Dual meet", distance: "5K", priority: "B" };
const satRace: Race = { id: "r2", date: SAT, name: "Invitational", distance: "5K", priority: "B" };

function ctx(over: Partial<RuleContext> & { today: string; dayType: RunType; phase: Phase }): RuleContext {
  return {
    races: [thuRace],
    settings: { ...DEFAULT_SETTINGS },
    history: [],
    ...over,
  };
}

function lift(date: string, strength: boolean, plyo: boolean, plyoTypes: string[] = []): LiftLog {
  return {
    id: date + strength + plyo,
    date,
    session: strength ? "full" : "plyos-isos",
    volume: "full",
    exerciseIds: [],
    hadStrength: strength,
    hadPlyo: plyo,
    plyoTypes,
  };
}

describe("Thursday-race week (default)", () => {
  const tuneUp = (phase: Phase) => decideSession(ctx({ today: MON, dayType: "workout", phase, settings: { ...DEFAULT_SETTINGS, tuneUpDay: "mon" } }));
  const raceDay = (phase: Phase, deepRaceDay: "half" | "plyos-isos" = "half") =>
    decideSession(ctx({ today: THU, dayType: "race", phase, settings: { ...DEFAULT_SETTINGS, deepRaceDay } }));

  it("tune-up day: Full in Early and Deep, Plyos + Isos in Championship", () => {
    const w = tuneUp("early");
    expect(w.role).toBe("thu-tuneup");
    expect(w).toMatchObject({ session: "full", half: false, strength: true, plyos: true });
    expect(tuneUp("deep")).toMatchObject({ session: "full", half: false });
    expect(tuneUp("championship")).toMatchObject({ session: "plyos-isos", strength: false, plyos: true });
  });

  it("never a lift on race day, in any phase or setting", () => {
    for (const phase of ["off", "early", "deep", "championship"] as Phase[]) {
      for (const deepRaceDay of ["half", "plyos-isos"] as const) {
        const r = raceDay(phase, deepRaceDay);
        expect(r.role).toBe("thu-race");
        expect(r).toMatchObject({ session: "none", strength: false, plyos: false });
      }
    }
    expect(raceDay("deep").why).toBe("Deep season, Thursday race day: no lift.");
  });

  it("no catch-up lift on a race day, and none the morning after a race", () => {
    const onRaceDay = decideCatchUp(ctx({ today: THU, dayType: "race", phase: "early" }), "workout");
    expect(onRaceDay).toBeNull();
    const dayAfter = decideCatchUp(ctx({ today: "2026-09-18", dayType: "easy", phase: "early" }), "race");
    expect(dayAfter).toBeNull();
  });

  it("Tuesday tune-up warns it's right at the 48h limit; Monday doesn't", () => {
    const tue = decideSession(ctx({ today: TUE, dayType: "workout", phase: "deep" }));
    expect(tue.role).toBe("thu-tuneup");
    expect(tue.session).toBe("full");
    expect(tue.warnings.join(" ")).toMatch(/Tuesday.*48h limit/);

    const mon = decideSession(
      ctx({ today: MON, dayType: "workout", phase: "deep", settings: { ...DEFAULT_SETTINGS, tuneUpDay: "mon" } }),
    );
    expect(mon.warnings).toHaveLength(0);
  });

  it("a Monday workout is the tune-up even when the setting says Tuesday", () => {
    const d = decideSession(ctx({ today: MON, dayType: "workout", phase: "early" }));
    expect(d.role).toBe("thu-tuneup");
    expect(d.session).toBe("full");
    expect(d.nextHard?.date).toBe(THU);
  });
});

describe("Races on other days (Saturday race: 1st = Tue, 2nd = Thu)", () => {
  const races = [satRace];
  const day = (today: string, phase: Phase, dayType: RunType = "workout") =>
    decideSession(ctx({ today, dayType, phase, races }));

  it("derives the two hard days before the race", () => {
    const hd = hardDays(MON, races, DEFAULT_SETTINGS).filter((h) => h.date >= MON && h.date <= SAT);
    expect(hd.map((h) => h.date)).toEqual([TUE, THU, SAT]);
  });

  it("Early: 1st = Full, 2nd = Full at half volume", () => {
    expect(day(TUE, "early")).toMatchObject({ role: "other-1st", session: "full", half: false });
    expect(day(THU, "early")).toMatchObject({ role: "other-2nd", session: "full", half: true });
  });

  it("Deep: 1st = Full, 2nd = Plyos + Isos", () => {
    expect(day(TUE, "deep")).toMatchObject({ role: "other-1st", session: "full" });
    expect(day(THU, "deep")).toMatchObject({ role: "other-2nd", session: "plyos-isos" });
  });

  it("Championship: both = Plyos + Isos", () => {
    expect(day(TUE, "championship")).toMatchObject({ session: "plyos-isos" });
    expect(day(THU, "championship")).toMatchObject({ session: "plyos-isos" });
  });

  it("race day is a hard day with no lift", () => {
    const r = day(SAT, "early", "race");
    expect(r.role).toBe("other-race");
    expect(r.session).toBe("none");
  });
});

describe("48h rule", () => {
  it("downgrades strength to Plyos + Isos when a hard day is under 48h away", () => {
    // Workout on Wednesday, race Thursday.
    const d = decideSession(ctx({ today: WED, dayType: "workout", phase: "early" }));
    expect(d.session).toBe("plyos-isos");
    expect(d.strength).toBe(false);
    expect(d.why).toMatch(/under 48h/);
  });

  it("next-morning catch-up allowed only if the next hard run is 48h+ away", () => {
    // Tue workout (Saturday-race week), no lift. Wed morning: next hard = Thu (1 day) → blocked.
    const blocked = decideCatchUp(ctx({ today: WED, dayType: "easy", phase: "early", races: [satRace] }), "workout");
    expect(blocked).toMatchObject({ blocked: expect.stringMatching(/48h/) });

    // Mon workout with a Thursday race, Tue morning: Thu is 2 days away → allowed.
    const ok = decideCatchUp(
      ctx({ today: TUE, dayType: "easy", phase: "early", settings: { ...DEFAULT_SETTINGS, tuneUpDay: "mon" } }),
      "workout",
    );
    expect(ok && "session" in ok && ok.session).toBe("full");
    expect(ok && "catchUpFor" in ok && ok.catchUpFor).toBe(MON);
  });

  it("no catch-up if yesterday was easy or already lifted", () => {
    expect(decideCatchUp(ctx({ today: TUE, dayType: "easy", phase: "early" }), "easy")).toBeNull();
    expect(
      decideCatchUp(ctx({ today: TUE, dayType: "easy", phase: "early", history: [lift(MON, true, true)] }), "workout"),
    ).toBeNull();
  });
});

describe("weekly caps (2 strength + 2 plyo per rolling 7 days)", () => {
  const raceFree = { races: [] as Race[] };

  it("strips strength after 2 strength sessions", () => {
    const history = [lift("2026-09-10", true, false), lift("2026-09-12", true, false)];
    const d = decideSession(ctx({ today: TUE, dayType: "workout", phase: "early", history, ...raceFree }));
    expect(d.strength).toBe(false);
    expect(d.session).toBe("plyos-isos");
    expect(d.plyos).toBe(true);
    expect(d.why).toMatch(/2 strength sessions/);
  });

  it("strips plyos after 2 plyo sessions", () => {
    const history = [lift("2026-09-10", false, true), lift("2026-09-12", false, true)];
    const d = decideSession(ctx({ today: TUE, dayType: "workout", phase: "early", history, ...raceFree }));
    expect(d).toMatchObject({ session: "full", strength: true, plyos: false });
  });

  it("only counts the last 7 days", () => {
    const history = [lift("2026-09-07", true, true), lift("2026-09-08", true, true)];
    const d = decideSession(ctx({ today: TUE, dayType: "workout", phase: "early", history, ...raceFree }));
    expect(d).toMatchObject({ strength: true, plyos: true });
  });

  it("both capped → isos only", () => {
    const history = [lift("2026-09-10", true, true), lift("2026-09-12", true, true)];
    const w = generateWorkout(input({ today: TUE, dayType: "workout", phase: "early", history, ...raceFree }));
    expect(w.title).toBe("Isos only");
    expect(w.items.every((i) => i.slot !== "A1" && i.slot !== "A2")).toBe(true);
  });
});

describe("easy / long / rest days", () => {
  it.each(["easy"] as const)("%s → optional upper body by default, no leg strength or plyos", (dayType) => {
    expect(decideSession(ctx({ today: WED, dayType, phase: "deep" }))).toMatchObject({
      session: "upper", optional: true, strength: false, plyos: false,
    });
  });

  it.each(["easy"] as const)("%s → touch-up when picked: 2-3 foot/calf/hip-flexor moves", (dayType) => {
    const d = decideSession(ctx({ today: WED, dayType, phase: "deep", easyFocus: "touch-up" }));
    expect(d).toMatchObject({ session: "touch-up", optional: true, strength: false, plyos: false });
    const w = generateWorkout(input({ today: WED, dayType, phase: "deep", easyFocus: "touch-up" }));
    expect(w.items.length).toBeGreaterThanOrEqual(2);
    expect(w.items.length).toBeLessThanOrEqual(3);
    expect(w.items.every((i) => ["C2", "D1"].includes(i.slot))).toBe(true);
    expect(w.estMinutes).toBeLessThanOrEqual(15);
  });

  it("rest → nothing", () => {
    const w = generateWorkout(input({ today: WED, dayType: "rest", phase: "deep" }));
    expect(w.decision.session).toBe("none");
    expect(w.items).toHaveLength(0);
  });
});

describe("modifiers", () => {
  it("return week → yielding isos only, 20-45 s holds", () => {
    const w = generateWorkout(
      input({ today: MON, dayType: "workout", phase: "early", settings: { ...DEFAULT_SETTINGS, tuneUpDay: "mon", returnWeek: true } }),
    );
    expect(w.decision.session).toBe("return");
    expect(w.items.length).toBeGreaterThanOrEqual(3);
    for (const i of w.items) {
      expect(i.exercise.session_types).toContain("return");
      expect(i.reps).toMatch(/20-45 s hold/);
      expect(i.exercise.name.toLowerCase()).not.toContain("overcoming");
    }
  });

  it("short on time → Short session template", () => {
    const w = generateWorkout({ ...input({ today: TUE, dayType: "workout", phase: "early", races: [] }), shortOnTime: true });
    expect(w.decision.session).toBe("short");
    expect(w.items.map((i) => i.slot)).toEqual(["A1", "B1", "C2", "C1"]);
    expect(w.items[0]).toMatchObject({ sets: 3, reps: "5" });
    expect(w.items[1].supersetWith).toBe(w.items[2].exercise.id);
  });
});

describe("phase suggestion", () => {
  it("A race within 3 weeks → Championship", () => {
    const races: Race[] = [{ ...thuRace, priority: "A", date: "2026-10-01" }];
    expect(suggestPhase(races, MON).phase).toBe("championship");
  });
  it("no races → Off-season", () => {
    expect(suggestPhase([], MON).phase).toBe("off");
  });
});

// ---------------------------------------------------------------------------

function input(over: Partial<GenerateInput> & { today: string; dayType: RunType; phase: Phase }): GenerateInput {
  return {
    races: [thuRace],
    history: [],
    block: null,
    ...over,
    settings: { ...DEFAULT_SETTINGS, ...(over.settings ?? {}) },
  };
}

export { input, ctx, lift, MON, TUE, WED, THU, FRI, SAT };
