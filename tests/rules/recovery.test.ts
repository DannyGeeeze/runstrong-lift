import { describe, expect, it } from "vitest";
import { suggestRecovery, type RecoveryInput } from "@/lib/rules";
import type { Race, RecoveryLog } from "@/lib/types";

const WED = "2026-09-16";
const input = (over: Partial<RecoveryInput> = {}): RecoveryInput => ({
  today: WED,
  todayType: "easy",
  yesterdayType: "easy",
  races: [],
  recovery: [],
  settings: { hasBoots: true, hasSauna: true },
  ...over,
});
const race = (date: string, priority: Race["priority"] = "B"): Race => ({ id: date, date, name: "Invite", distance: "5K", priority });
const sauna = (date: string): RecoveryLog => ({ id: date, date, kind: "sauna" });

describe("recovery suggestions", () => {
  it("easy day → sauna", () => {
    const s = suggestRecovery(input());
    expect(s.kind).toBe("sauna");
    expect(s.saunaWarning).toBeNull();
  });

  it("workout, race or long run → boots", () => {
    for (const todayType of ["workout", "race", "long"] as const) {
      expect(suggestRecovery(input({ todayType })).kind).toBe("boots");
    }
    expect(suggestRecovery(input({ todayType: "long" })).why).toMatch(/long run/);
  });

  it("race tomorrow → boots, and sauna is flagged", () => {
    const s = suggestRecovery(input({ races: [race("2026-09-17", "C")] }));
    expect(s.kind).toBe("boots");
    expect(s.why).toMatch(/tomorrow/);
    expect(s.saunaWarning).toMatch(/tomorrow, so no sauna/);
  });

  it("no sauna 2 days before an A or B race, but a C race 2 days out is fine", () => {
    expect(suggestRecovery(input({ races: [race("2026-09-18", "A")] })).kind).toBeNull();
    expect(suggestRecovery(input({ races: [race("2026-09-18", "B")] })).saunaWarning).toMatch(/in 2 days/);
    expect(suggestRecovery(input({ races: [race("2026-09-18", "C")] })).kind).toBe("sauna");
  });

  it("catch-up boots the day after a hard day with none", () => {
    const s = suggestRecovery(input({ yesterdayType: "workout" }));
    expect(s.kind).toBe("boots");
    expect(s.why).toMatch(/yesterday's workout/);
    const done: RecoveryLog = { id: "b", date: "2026-09-15", kind: "boots" };
    expect(suggestRecovery(input({ yesterdayType: "workout", recovery: [done] })).kind).toBe("sauna");
  });

  it("sauna: not two days in a row, max 3 in 7 days", () => {
    expect(suggestRecovery(input({ recovery: [sauna("2026-09-15")] })).saunaWarning).toMatch(/yesterday/);
    const three = [sauna("2026-09-10"), sauna("2026-09-12"), sauna("2026-09-14")];
    expect(suggestRecovery(input({ recovery: three })).saunaWarning).toMatch(/already 3 saunas/);
    // The one 7 days ago has dropped out of the window.
    const old = [sauna("2026-09-09"), sauna("2026-09-12"), sauna("2026-09-14")];
    expect(suggestRecovery(input({ recovery: old })).kind).toBe("sauna");
  });

  it("rest day suggests nothing", () => {
    const s = suggestRecovery(input({ todayType: "rest" }));
    expect(s.kind).toBeNull();
    expect(s.options).toEqual(["boots", "sauna"]);
  });

  it("only suggests what the runner has", () => {
    expect(suggestRecovery(input({ settings: { hasBoots: false, hasSauna: true }, todayType: "workout" })).kind).toBeNull();
    const noSauna = suggestRecovery(input({ settings: { hasBoots: true, hasSauna: false } }));
    expect(noSauna.kind).toBeNull();
    expect(noSauna.options).toEqual(["boots"]);
    expect(noSauna.saunaWarning).toBeNull();
  });
});
