// Movement patterns for exercise demos. Each is a short loop of keyframes on
// the rig in rig.ts, drawn in a 120 x 90 box with the ground at y = 80.
// Side-view figures face right.

import type { KneeBias, LegPose, Pose, Vec } from "./rig";

export const GROUND = 80;

export type Prop =
  | { kind: "barBack" }
  | { kind: "barHands" }
  | { kind: "dumbbells" }
  | { kind: "box"; x: number; y: number; w: number; h: number }
  | { kind: "bandFoot"; to: Vec }
  | { kind: "bandKnees" }
  | { kind: "strap"; x: number };

export interface Frame {
  pose: Pose;
  /** Seconds to move here from the previous frame. */
  move: number;
  /** Seconds to stay once here. */
  hold?: number;
}

export interface Pattern {
  id: string;
  view: "side" | "front";
  frames: Frame[];
  props?: Prop[];
  /** Frame shown (still) for isometric holds. */
  holdFrame: number;
  /** Jump straight from the last frame back to the first (e.g. back up onto the box). */
  cut?: boolean;
}

// Shorthand ------------------------------------------------------------------

const F = 79; // ankle height with a flat foot
const L = (x: number, y: number, foot: number, knee: KneeBias = "f"): LegPose => ({ ankle: [x, y], foot, knee });
const P = (
  hip: Vec,
  torso: number,
  a: LegPose,
  b: LegPose,
  armA: [number, number] = [182, 178],
  armB: [number, number] = [178, 182],
): Pose => ({ hip, torso, a, b, armA, armB });

const STAND = P([58, 44.6], 0, L(59.5, F, 90), L(57.5, F, 90));

// Patterns -----------------------------------------------------------------

const squat: Pattern = {
  id: "squat",
  view: "side",
  props: [{ kind: "barBack" }],
  holdFrame: 1,
  frames: [
    { pose: P([58, 44.6], 3, L(60, F, 90), L(58, F, 90), [215, 330], [215, 330]), move: 0.6, hold: 0.3 },
    { pose: P([45, 62], 42, L(60, F, 90), L(58, F, 90), [230, 345], [230, 345]), move: 1.1, hold: 0.15 },
  ],
};

const hinge: Pattern = {
  id: "hinge",
  view: "side",
  props: [{ kind: "barHands" }],
  holdFrame: 1,
  frames: [
    { pose: P([58.5, 44.6], 2, L(60, F, 90), L(58, F, 90), [182, 180], [180, 182]), move: 0.7, hold: 0.3 },
    { pose: P([47, 48], 78, L(60, F, 90), L(58, F, 90), [178, 180], [176, 178]), move: 1.2, hold: 0.2 },
  ],
};

const splitSquat: Pattern = {
  id: "split-squat",
  view: "side",
  props: [{ kind: "dumbbells" }],
  holdFrame: 1,
  frames: [
    { pose: P([52, 46], 2, L(65, F, 90), L(38, 76, 135, "d")), move: 0.6, hold: 0.3 },
    { pose: P([50, 59], 6, L(65, F, 90), L(38, 76, 135, "d")), move: 1.0, hold: 0.2 },
  ],
};

const calfRaise: Pattern = {
  id: "calf-raise",
  view: "side",
  holdFrame: 1,
  frames: [
    { pose: STAND, move: 0.6, hold: 0.3 },
    { pose: P([60, 38.6], 0, L(61, 73, 150), L(59, 73, 150)), move: 0.6, hold: 0.5 },
  ],
};

const tibRaise: Pattern = {
  id: "tib-raise",
  view: "side",
  holdFrame: 1,
  frames: [
    { pose: P([54, 45], -4, L(59, F, 90), L(57, F, 90)), move: 0.5, hold: 0.2 },
    { pose: P([53, 45], -6, L(59, F, 45), L(57, F, 45)), move: 0.5, hold: 0.4 },
  ],
};

const pogo: Pattern = {
  id: "pogo",
  view: "side",
  holdFrame: 0,
  frames: [
    { pose: P([56, 46], 2, L(59, 77, 125), L(57, 77, 125), [170, 150], [175, 155]), move: 0.17 },
    { pose: P([56, 37], 0, L(59, 68, 150), L(57, 68, 150), [165, 140], [170, 145]), move: 0.17 },
  ],
};

const hop: Pattern = {
  id: "hop",
  view: "side",
  holdFrame: 0,
  frames: [
    { pose: P([55, 47], 8, L(60, 78, 110), L(47, 62, 160), [150, 110], [215, 200]), move: 0.28 },
    { pose: P([57, 35], 6, L(57, 66, 145), L(50, 58, 165), [200, 180], [150, 120]), move: 0.3 },
  ],
};

const skip: Pattern = {
  id: "skip",
  view: "side",
  holdFrame: 0,
  frames: [
    { pose: P([56, 45], 2, L(57, F, 100), L(70, 60, 100), [215, 180], [140, 70]), move: 0.3 },
    { pose: P([56, 42], 2, L(56, 76, 130), L(60, 72, 125), [180, 140], [180, 140]), move: 0.2 },
    { pose: P([56, 45], 2, L(70, 60, 100), L(57, F, 100), [140, 70], [215, 180]), move: 0.3 },
    { pose: P([56, 42], 2, L(60, 72, 125), L(56, 76, 130), [180, 140], [180, 140]), move: 0.2 },
  ],
};

const jump: Pattern = {
  id: "jump",
  view: "side",
  holdFrame: 0,
  frames: [
    { pose: STAND, move: 0.4, hold: 0.3 },
    { pose: P([47, 58], 40, L(60, F, 90), L(58, F, 90), [225, 210], [225, 210]), move: 0.45, hold: 0.05 },
    { pose: P([58, 34], 2, L(59.5, 68.5, 150), L(57.5, 68.5, 150), [35, 25], [35, 25]), move: 0.28 },
    { pose: P([48, 56], 32, L(60, F, 90), L(58, F, 90), [150, 120], [150, 120]), move: 0.28, hold: 0.25 },
  ],
};

const BOX = { kind: "box" as const, x: 22, y: 60, w: 26, h: 20 };
const dropJump: Pattern = {
  id: "drop-jump",
  view: "side",
  props: [BOX],
  holdFrame: 3,
  cut: true,
  frames: [
    { pose: P([38, 26], 2, L(41, 59, 90), L(39, 59, 90)), move: 0.4, hold: 0.4 },
    { pose: P([46, 27], 4, L(52, 57, 120), L(40, 59, 90)), move: 0.3 },
    { pose: P([58, 36], 2, L(60, 70, 130), L(58, 70, 130), [160, 140], [160, 140]), move: 0.25 },
    { pose: P([60, 50], 18, L(64, 78, 105), L(62, 78, 105), [205, 200], [205, 200]), move: 0.12 },
    { pose: P([65, 32], 0, L(66.5, 66.5, 150), L(64.5, 66.5, 150), [35, 25], [35, 25]), move: 0.25 },
    { pose: P([64, 50], 22, L(68, F, 90), L(66, F, 90), [160, 140], [160, 140]), move: 0.3, hold: 0.5 },
  ],
};

// Front view: leg A is screen-left, leg B screen-right.
const lateralBound: Pattern = {
  id: "lateral-bound",
  view: "front",
  holdFrame: 0,
  frames: [
    { pose: P([78, 50], 18, L(66, 68, 270, "l"), L(84, F, 90, "r"), [220, 200], [150, 120]), move: 0.35, hold: 0.15 },
    { pose: P([60, 36], 0, L(54, 68, 270, "l"), L(66, 68, 90, "r"), [200, 190], [160, 170]), move: 0.25 },
    { pose: P([42, 50], -18, L(36, F, 270, "l"), L(54, 68, 90, "r"), [210, 240], [140, 160]), move: 0.25, hold: 0.15 },
    { pose: P([60, 36], 0, L(54, 68, 270, "l"), L(66, 68, 90, "r"), [200, 190], [160, 170]), move: 0.35 },
  ],
};

const bandWalk: Pattern = {
  id: "band-walk",
  view: "front",
  props: [{ kind: "bandKnees" }],
  holdFrame: 0,
  frames: [
    { pose: P([58, 49], 0, L(48, F, 270, "l"), L(68, F, 90, "r"), [195, 175], [165, 185]), move: 0.5, hold: 0.2 },
    { pose: P([61, 49], 3, L(48, F, 270, "l"), L(76, 75, 90, "r"), [195, 175], [165, 185]), move: 0.5 },
    { pose: P([64, 49], 0, L(52, 75, 270, "l"), L(78, F, 90, "r"), [195, 175], [165, 185]), move: 0.45, hold: 0.2 },
    { pose: P([61, 49], -3, L(48, 75, 270, "l"), L(76, F, 90, "r"), [195, 175], [165, 185]), move: 0.45 },
  ],
};

const kneeDrive: Pattern = {
  id: "knee-drive",
  view: "side",
  props: [{ kind: "bandFoot", to: [14, 78] }],
  holdFrame: 1,
  frames: [
    { pose: P([58, 44.6], 0, L(59.5, F, 90), L(56, 77, 120)), move: 0.5, hold: 0.2 },
    { pose: P([58, 44.6], -2, L(59.5, F, 90), L(75, 60, 100, "f"), [140, 110], [215, 200]), move: 0.35, hold: 0.4 },
  ],
};

const bridge: Pattern = {
  id: "bridge",
  view: "side",
  holdFrame: 1,
  frames: [
    { pose: P([56, 71], 262, L(74, F, 60, "u"), L(72, F, 60, "u"), [100, 92], [100, 92]), move: 0.6, hold: 0.3 },
    { pose: P([54, 60], 231, L(74, F, 60, "u"), L(72, F, 60, "u"), [102, 90], [102, 90]), move: 0.6, hold: 0.5 },
  ],
};

const nordic: Pattern = {
  id: "nordic",
  view: "side",
  props: [{ kind: "strap", x: 33 }],
  holdFrame: 1,
  frames: [
    { pose: P([50, 60], 0, L(33, 78, 270, "d"), L(31, 78, 270, "d"), [182, 178], [178, 182]), move: 0.8, hold: 0.4 },
    { pose: P([61.6, 64.2], 40, L(33, 78, 270, "d"), L(31, 78, 270, "d"), [140, 120], [140, 120]), move: 2.2 },
    { pose: P([66.5, 70], 62, L(33, 78, 270, "d"), L(31, 78, 270, "d"), [130, 175], [130, 175]), move: 0.8, hold: 0.3 },
  ],
};

const BENCH = { kind: "box" as const, x: 92, y: 60, w: 24, h: 20 };
const copenhagen: Pattern = {
  id: "copenhagen",
  view: "side",
  props: [BENCH],
  holdFrame: 0,
  frames: [
    { pose: P([62, 59], 252, L(95, 58, 90, "u"), L(93, 66, 90, "d"), [166, 268], [166, 268]), move: 0.8, hold: 0.8 },
    { pose: P([62, 66.5], 270, L(95, 58, 90, "u"), L(93, 71, 90, "d"), [166, 268], [166, 268]), move: 0.8, hold: 0.3 },
  ],
};

const row: Pattern = {
  id: "row",
  view: "side",
  props: [{ kind: "dumbbells" }],
  holdFrame: 1,
  frames: [
    { pose: P([49, 48], 62, L(60, F, 90), L(58, F, 90), [180, 180], [180, 180]), move: 0.7, hold: 0.2 },
    { pose: P([49, 48], 62, L(60, F, 90), L(58, F, 90), [245, 180], [245, 180]), move: 0.5, hold: 0.4 },
  ],
};

export const PATTERNS: Record<string, Pattern> = Object.fromEntries(
  [squat, hinge, splitSquat, calfRaise, tibRaise, pogo, hop, skip, jump, dropJump, lateralBound, bandWalk, kneeDrive, bridge, nordic, copenhagen, row].map(
    (p) => [p.id, p],
  ),
);

// Playback -----------------------------------------------------------------

export function cycleLength(p: Pattern): number {
  return p.frames.reduce((s, f) => s + f.move + (f.hold ?? 0), 0);
}

/** Pose at time t (seconds) in a looping pattern. */
export function poseAt(p: Pattern, t: number, blend: (a: Pose, b: Pose, t: number) => Pose, ease: (t: number) => number): Pose {
  const total = cycleLength(p);
  let time = ((t % total) + total) % total;
  const n = p.frames.length;
  for (let i = 0; i < n; i++) {
    const f = p.frames[i];
    const prev = p.frames[(i - 1 + n) % n];
    if (time < f.move) {
      // The cut from the last frame back to the first happens instantly.
      if (i === 0 && p.cut) return f.pose;
      return blend(prev.pose, f.pose, ease(time / f.move));
    }
    time -= f.move;
    if (time < (f.hold ?? 0)) return f.pose;
    time -= f.hold ?? 0;
  }
  return p.frames[0].pose;
}
