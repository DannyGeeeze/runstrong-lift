import { describe, expect, it } from "vitest";
import { ALL_EXERCISES } from "@/lib/exercises";
import { embedFor, patternFor } from "@/lib/demo/match";
import { cycleLength, PATTERNS, poseAt } from "@/lib/demo/patterns";
import { blend, BONES, easeInOut, solve } from "@/lib/demo/rig";

describe("exercise demos", () => {
  it("every exercise in the bank has an animation", () => {
    for (const e of ALL_EXERCISES) expect(patternFor(e), e.id).toBeTruthy();
  });

  it("matches common exercises to the right movement", () => {
    const id = (x: string) => patternFor(ALL_EXERCISES.find((e) => e.id === x)!).id;
    expect(id("drop-jump")).toBe("drop-jump");
    expect(id("back-squat")).toBe("squat");
    expect(id("rdl")).toBe("hinge");
    expect(id("nordic")).toBe("nordic");
    expect(id("copenhagen")).toBe("copenhagen");
    expect(id("monster-walk")).toBe("band-walk");
    expect(id("pogo")).toBe("pogo");
    expect(id("bulgarian-split-squat")).toBe("bss");
    expect(id("dumbbell-split-squat")).toBe("split-squat");
    expect(id("sl-calf-raise")).toBe("sl-calf");
    expect(id("bb-calf-raise")).toBe("calf-raise");
    expect(id("skater-bound")).toBe("lateral-bound");
    expect(id("physioball-oscillation")).toBe("ham-curl");
    expect(id("glute-hip-thrust")).toBe("bridge");
  });

  it("moves that used to get a wrong animation now get a fitting one", () => {
    const id = (x: string) => patternFor(ALL_EXERCISES.find((e) => e.id === x)!).id;
    const expected: Record<string, string> = {
      "heel-elevated-goblet-squat": "squat",
      "iyt-on-bench": "prone-raise",
      "w-on-bench": "prone-raise",
      "razor-curl": "nordic",
      "ghd-razor-curl": "nordic",
      "sled-push-pull": "carry",
      "butterfly-hip-lifts": "bridge",
      "split-squat-oscillations-deep-tier": "split-pogo",
      "slider-rdl": "hinge",
      "barbell-bench-press": "push-up",
      "clean-deadlift": "hinge",
      "single-leg-dumbbell-contralateral-rdl": "sl-rdl",
      "dumbbell-farmer-carry": "carry",
      "med-ball-slam": "slam",
      "back-extension": "back-extension",
      "seated-calf-raise": "soleus-raise",
      "short-foot": "foot-work",
      "toe-abduction-adduction": "foot-work",
      "blind-bosu": "balance",
      "dumbbell-step-up": "step-up",
      "dumbbell-reverse-lunge": "lunge",
      "hip-flexor-flutter-oscillations": "knee-drive",
      deadhang: "pull-down",
    };
    for (const [ex, pattern] of Object.entries(expected)) expect(id(ex), ex).toBe(pattern);
  });

  it("no animation is shared by too many moves", () => {
    const count: Record<string, number> = {};
    for (const e of ALL_EXERCISES) count[patternFor(e).id] = (count[patternFor(e).id] ?? 0) + 1;
    for (const [p, n] of Object.entries(count)) expect(n, p).toBeLessThanOrEqual(30);
  });

  it("which animation each exercise gets is locked in (update the snapshot on purpose)", () => {
    const map = Object.fromEntries(ALL_EXERCISES.map((e) => [e.id, patternFor(e).id]));
    expect(map).toMatchSnapshot();
  });

  it("every pose can be reached: no leg asked to stretch past its length", () => {
    const reach = BONES.thigh + BONES.shin + 1.5;
    for (const p of Object.values(PATTERNS)) {
      p.frames.forEach((f, i) => {
        const sk = solve(f.pose, p.view);
        for (const [hip, leg] of [[sk.hipA, f.pose.a], [sk.hipB, f.pose.b]] as const) {
          const d = Math.hypot(leg.ankle[0] - hip[0], leg.ankle[1] - hip[1]);
          expect(d, `${p.id} frame ${i}`).toBeLessThanOrEqual(reach);
        }
      });
    }
  });

  it("every animation frame is a valid figure with feet at or above the floor", () => {
    for (const p of Object.values(PATTERNS)) {
      const total = cycleLength(p);
      for (let i = 0; i <= 40; i++) {
        const sk = solve(poseAt(p, (total * i) / 40, blend, easeInOut), p.view);
        const all = [...sk.legA, ...sk.legB, ...sk.armA, ...sk.armB, sk.head];
        for (const [x, y] of all) {
          expect(Number.isFinite(x) && Number.isFinite(y), p.id).toBe(true);
          expect(y, `${p.id} dips below the floor`).toBeLessThan(81.5);
          expect(y, `${p.id} goes off the top`).toBeGreaterThan(-14 + BONES.head - 6);
        }
      }
    }
  });

  it("embeds direct video links and ignores category pages", () => {
    expect(embedFor("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(embedFor("https://youtu.be/dQw4w9WgXcQ")?.src).toContain("/embed/dQw4w9WgXcQ");
    expect(embedFor("https://www.youtube.com/shorts/abcDEF12345")?.aspect).toBeLessThan(1);
    expect(embedFor("https://www.instagram.com/reel/C1a2B3c4D5e/")?.src).toBe("https://www.instagram.com/reel/C1a2B3c4D5e/embed");
    expect(embedFor("https://vimeo.com/123456")?.src).toBe("https://player.vimeo.com/video/123456");
    expect(embedFor("https://www.therunstrongcoach.com/exercise-browse-plyometrics")).toBeNull();
    expect(embedFor(undefined)).toBeNull();
  });
});
