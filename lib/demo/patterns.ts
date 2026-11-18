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
  | { kind: "strap"; x: number }
  /** Physioball under the far foot; rolls with it. */
  | { kind: "ballFeet" }
  /** Medicine ball in the hands. */
  | { kind: "medBall" }
  /** Weight plate resting on the knees (seated calf raise). */
  | { kind: "plateKnees" }
  /** Balance pad under the near foot. */
  | { kind: "pad" }
  /** Any fixed piece of equipment, drawn like a box. */
  | { kind: "shape"; points: Vec[] };

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


// Easy-day upper body -----------------------------------------------

const press: Pattern = {
  id: "press",
  view: "side",
  props: [{ kind: "dumbbells" }],
  holdFrame: 1,
  frames: [
    { pose: P([58, 44.6], 0, L(59.5, F, 90), L(57.5, F, 90), [165, 15], [165, 15]), move: 0.6, hold: 0.25 },
    { pose: P([58, 44.6], -2, L(59.5, F, 90), L(57.5, F, 90), [5, 5], [5, 5]), move: 0.7, hold: 0.3 },
  ],
};

// Plank line: toes at (20, 76), body straight to the shoulders.
const pushUp: Pattern = {
  id: "push-up",
  view: "side",
  holdFrame: 0,
  frames: [
    { pose: P([52.7, 63.5], 69, L(20, 76, 140, "u"), L(21, 76, 140, "u"), [180, 180], [180, 180]), move: 0.4, hold: 0.25 },
    { pose: P([53.7, 67.4], 75.5, L(20, 76, 140, "u"), L(21, 76, 140, "u"), [226, 140], [226, 140]), move: 0.45 },
    { pose: P([54.7, 71.3], 82, L(20, 76, 140, "u"), L(21, 76, 140, "u"), [250, 131], [250, 131]), move: 0.45, hold: 0.15 },
    { pose: P([53.7, 67.4], 75.5, L(20, 76, 140, "u"), L(21, 76, 140, "u"), [226, 140], [226, 140]), move: 0.4 },
  ],
};

const plank: Pattern = {
  id: "plank",
  view: "side",
  holdFrame: 0,
  frames: [
    { pose: P([54.6, 70.7], 81, L(20, 76, 140, "u"), L(21, 76, 140, "u"), [180, 90], [180, 90]), move: 1.2, hold: 1 },
    { pose: P([54.8, 69.8], 79, L(20, 76, 140, "u"), L(21, 76, 140, "u"), [180, 90], [180, 90]), move: 1.2, hold: 1 },
  ],
};

// Elbows stay at the sides; only the forearms move.
const curl: Pattern = {
  id: "curl",
  view: "side",
  props: [{ kind: "dumbbells" }],
  holdFrame: 1,
  frames: [
    { pose: P([58, 44.6], 0, L(59.5, F, 90), L(57.5, F, 90), [180, 175], [180, 175]), move: 0.7, hold: 0.15 },
    { pose: P([58, 44.6], 0, L(59.5, F, 90), L(57.5, F, 90), [175, 30], [175, 30]), move: 0.6, hold: 0.25 },
  ],
};

// Upper arms point up; the weight goes down behind the head and back up.
const tricepsExtension: Pattern = {
  id: "triceps-extension",
  view: "side",
  props: [{ kind: "dumbbells" }],
  holdFrame: 0,
  frames: [
    { pose: P([58, 44.6], 0, L(59.5, F, 90), L(57.5, F, 90), [18, 18], [18, 18]), move: 0.6, hold: 0.2 },
    { pose: P([58, 44.6], 0, L(59.5, F, 90), L(57.5, F, 90), [18, 215], [18, 215]), move: 0.8, hold: 0.15 },
  ],
};

// Front view: arms rise out to the sides to shoulder height.
const lateralRaise: Pattern = {
  id: "lateral-raise",
  view: "front",
  props: [{ kind: "dumbbells" }],
  holdFrame: 1,
  frames: [
    { pose: P([58, 44.6], 0, L(54, F, 270, "l"), L(62, F, 90, "r"), [190, 185], [170, 175]), move: 0.7, hold: 0.15 },
    { pose: P([58, 44.6], 0, L(54, F, 270, "l"), L(62, F, 90, "r"), [265, 260], [95, 100]), move: 0.6, hold: 0.3 },
  ],
};

// Front view: arms straight overhead, then elbows pulled down to the ribs.
const pullDown: Pattern = {
  id: "pull-down",
  view: "front",
  holdFrame: 1,
  frames: [
    { pose: P([58, 44.6], 0, L(54, F, 270, "l"), L(62, F, 90, "r"), [340, 345], [20, 15]), move: 0.7, hold: 0.15 },
    { pose: P([58, 44.6], 0, L(54, F, 270, "l"), L(62, F, 90, "r"), [205, 350], [155, 10]), move: 0.6, hold: 0.3 },
  ],
};


// More patterns: split out of the big shared groups ---------------------------

// Lying on the back, heels on a ball, hips up; curl the ball in and push it out.
const hamCurl: Pattern = {
  id: "ham-curl",
  view: "side",
  props: [{ kind: "ballFeet" }],
  holdFrame: 1,
  frames: [
    { pose: P([50, 66], 248, L(83, 69, 30, "u"), L(82, 69, 30, "u"), [100, 92], [100, 92]), move: 0.7, hold: 0.25 },
    { pose: P([53, 60], 236, L(70, 69, 45, "u"), L(69, 69, 45, "u"), [100, 92], [100, 92]), move: 0.7, hold: 0.25 },
  ],
};

// Split stance, quick small bounces off both feet.
const splitPogo: Pattern = {
  id: "split-pogo",
  view: "side",
  holdFrame: 0,
  frames: [
    { pose: P([52, 49], 4, L(65, 78, 105), L(39, 77, 135, "d"), [150, 120], [215, 200]), move: 0.17 },
    { pose: P([52, 44], 2, L(65, 75, 125), L(39, 73, 140, "d"), [160, 130], [205, 190]), move: 0.17 },
  ],
};

const BSS_BENCH = { kind: "box" as const, x: 14, y: 64, w: 22, h: 16 };
// Rear foot laces-down on a bench, front foot flat; sink straight down.
const bss: Pattern = {
  id: "bss",
  view: "side",
  props: [BSS_BENCH, { kind: "dumbbells" }],
  holdFrame: 1,
  frames: [
    { pose: P([52, 47], 6, L(61, F, 90), L(31, 61, 250, "d")), move: 0.6, hold: 0.25 },
    { pose: P([49, 58], 12, L(61, F, 90), L(31, 61, 250, "d")), move: 1.0, hold: 0.2 },
  ],
};

// Reverse lunge: step back, drop the back knee, step back up.
const lunge: Pattern = {
  id: "lunge",
  view: "side",
  props: [{ kind: "dumbbells" }],
  holdFrame: 1,
  frames: [
    { pose: STAND, move: 0.6, hold: 0.25 },
    { pose: P([51, 59], 6, L(62, F, 90), L(31, 77, 122, "d")), move: 0.8, hold: 0.2 },
  ],
};

const STEP_BOX = { kind: "box" as const, x: 60, y: 64, w: 26, h: 16 };
// Step up onto a box, drive the other knee up, step back down.
const stepUp: Pattern = {
  id: "step-up",
  view: "side",
  props: [STEP_BOX, { kind: "dumbbells" }],
  holdFrame: 2,
  frames: [
    { pose: P([46, 44.6], 0, L(47.5, F, 90), L(45.5, F, 90)), move: 0.5, hold: 0.25 },
    { pose: P([52, 46], 14, L(68, 63, 90), L(45.5, F, 90)), move: 0.5 },
    { pose: P([67, 29], 2, L(68, 63, 90), L(76, 46, 100), [215, 200], [150, 120]), move: 0.6, hold: 0.3 },
    { pose: P([52, 46], 14, L(68, 63, 90), L(45.5, F, 90)), move: 0.6 },
  ],
};

// Hinge on one leg; the free leg rises behind in line with the back.
const slRdl: Pattern = {
  id: "sl-rdl",
  view: "side",
  props: [{ kind: "dumbbells" }],
  holdFrame: 1,
  frames: [
    { pose: P([58, 44.6], 2, L(59.5, F, 90), L(53, 72, 130, "f")), move: 0.7, hold: 0.25 },
    { pose: P([53, 47], 80, L(59, F, 90), L(20, 47, 185, "d")), move: 1.1, hold: 0.25 },
  ],
};

const SEAT = { kind: "box" as const, x: 24, y: 64, w: 26, h: 16 };
// Seated, knees bent, plate on the knees: heels up and down (soleus).
const soleusRaise: Pattern = {
  id: "soleus-raise",
  view: "side",
  props: [SEAT, { kind: "plateKnees" }],
  holdFrame: 1,
  frames: [
    { pose: P([42, 61], 4, L(61, F, 90), L(59, F, 90), [140, 175], [140, 175]), move: 0.6, hold: 0.25 },
    { pose: P([42, 61], 4, L(62, 73, 150), L(60, 73, 150), [137, 172], [137, 172]), move: 0.6, hold: 0.4 },
  ],
};

// Seated foot work: toes lift and press down.
const footWork: Pattern = {
  id: "foot-work",
  view: "side",
  props: [SEAT],
  holdFrame: 0,
  frames: [
    { pose: P([42, 61], 4, L(61, F, 90), L(59, F, 90), [160, 150], [160, 150]), move: 0.6, hold: 0.4 },
    { pose: P([42, 61], 4, L(61, F, 58), L(59, F, 90), [160, 150], [160, 150]), move: 0.5, hold: 0.4 },
  ],
};

// One leg, other foot tucked behind, hand on a wall.
const slCalf: Pattern = {
  id: "sl-calf",
  view: "side",
  holdFrame: 1,
  props: [{ kind: "shape", points: [[90, -4], [94, -6], [94, 78], [90, 80]] }],
  frames: [
    { pose: P([58, 44.6], 0, L(59.5, F, 90), L(50, 66, 140, "f"), [100, 95], [180, 175]), move: 0.6, hold: 0.25 },
    { pose: P([60, 38.6], 0, L(61, 73, 150), L(52, 60, 140, "f"), [97, 92], [180, 175]), move: 0.6, hold: 0.5 },
  ],
};

// Standing on one leg on a pad, passing a ball around.
const balance: Pattern = {
  id: "balance",
  view: "side",
  props: [{ kind: "pad" }, { kind: "medBall" }],
  holdFrame: 0,
  frames: [
    { pose: P([57, 45.5], 3, L(59.5, 77, 90), L(66, 64, 110), [140, 100], [140, 100]), move: 0.7, hold: 0.15 },
    { pose: P([57, 45.5], -2, L(59.5, 77, 90), L(66, 64, 110), [35, 15], [35, 15]), move: 0.7, hold: 0.15 },
    { pose: P([57, 45.5], 6, L(59.5, 77, 90), L(66, 64, 110), [170, 150], [170, 150]), move: 0.7, hold: 0.15 },
  ],
};

// Farmer carry: tall walk with a weight in each hand.
const carry: Pattern = {
  id: "carry",
  view: "side",
  props: [{ kind: "dumbbells" }],
  holdFrame: 0,
  frames: [
    { pose: P([58, 45.5], 0, L(66, F, 90), L(50, 77, 125), [180, 180], [180, 180]), move: 0.32 },
    { pose: P([58, 44.6], 0, L(58.5, F, 90), L(62, 72, 110), [180, 180], [180, 180]), move: 0.32 },
    { pose: P([58, 45.5], 0, L(50, 77, 125), L(66, F, 90), [180, 180], [180, 180]), move: 0.32 },
    { pose: P([58, 44.6], 0, L(62, 72, 110), L(58.5, F, 90), [180, 180], [180, 180]), move: 0.32 },
  ],
};

const PRONE_BENCH = { kind: "box" as const, x: 18, y: 54, w: 44, h: 26 };
// Face down on a bench, arms hanging; raise them in line with the body (I / Y / T).
const proneRaise: Pattern = {
  id: "prone-raise",
  view: "side",
  props: [PRONE_BENCH],
  holdFrame: 1,
  frames: [
    { pose: P([44, 50], 90, L(11, 52, 175, "d"), L(12, 53, 175, "d"), [178, 178], [178, 178]), move: 0.7, hold: 0.2 },
    { pose: P([44, 50], 90, L(11, 52, 175, "d"), L(12, 53, 175, "d"), [92, 92], [88, 88]), move: 0.7, hold: 0.5 },
  ],
};

// 45° back extension: hips on the pad, heels anchored; lower the chest and lift back to a straight line.
const backExtension: Pattern = {
  id: "back-extension",
  view: "side",
  props: [
    // Hip pad under the front of the thighs, its post, and the heel plate.
    { kind: "shape", points: [[56.5, 49], [49.5, 58], [52.7, 60.4], [59.7, 51.4]] },
    { kind: "shape", points: [[50, 59], [54, 59], [54, 80], [50, 80]] },
    { kind: "shape", points: [[26, 76], [42, 76], [42, 80], [26, 80]] },
  ],
  holdFrame: 0,
  frames: [
    { pose: P([55, 46], 37, L(34, 74, 145, "d"), L(33, 74, 145, "d"), [150, 60], [150, 60]), move: 0.8, hold: 0.4 },
    { pose: P([55, 46], 132, L(34, 74, 145, "d"), L(33, 74, 145, "d"), [175, 95], [175, 95]), move: 0.9, hold: 0.2 },
  ],
};

// Ball overhead on the toes, then slam it into the floor.
const slam: Pattern = {
  id: "slam",
  view: "side",
  props: [{ kind: "medBall" }],
  holdFrame: 0,
  frames: [
    { pose: P([58, 40], -4, L(59.5, 74, 140), L(57.5, 74, 140), [10, 5], [10, 5]), move: 0.6, hold: 0.25 },
    { pose: P([49, 56], 50, L(61, F, 90), L(59, F, 90), [130, 140], [130, 140]), move: 0.25, hold: 0.35 },
  ],
};

export const PATTERNS: Record<string, Pattern> = Object.fromEntries(
  [hamCurl, splitPogo, bss, lunge, stepUp, slRdl, soleusRaise, footWork, slCalf, balance, carry, proneRaise, backExtension, slam, squat, hinge, splitSquat, calfRaise, tibRaise, pogo, hop, skip, jump, dropJump, lateralBound, bandWalk, kneeDrive, bridge, nordic, copenhagen, row, press, pushUp, plank, curl, tricepsExtension, lateralRaise, pullDown].map(
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
