import { describe, expect, it } from "vitest";
import { isSampleRace, sampleRaces } from "@/lib/mock";

describe("sample races", () => {
  it("are marked, so they can't pass for real meets", () => {
    const s = sampleRaces("2026-11-18");
    expect(s).toHaveLength(4);
    for (const r of s) {
      expect(r.sample).toBe(true);
      expect(isSampleRace(r)).toBe(true);
    }
  });

  it("recognizes leftovers from older sample seasons by their id", () => {
    expect(isSampleRace({ id: "sample-0", date: "2026-11-19", name: "Dual meet", priority: "C" })).toBe(true);
  });

  it("leaves your own races alone", () => {
    expect(isSampleRace({ id: "9g799nv8mwmuik9m", date: "2026-12-10", name: "Meet vs Framingham", priority: "B" })).toBe(false);
    expect(isSampleRace({ id: "abc", date: "2026-12-10", name: "Sample meet", priority: "C", sample: false })).toBe(false);
  });
});
