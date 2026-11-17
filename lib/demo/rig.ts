// A tiny 2D stick-figure rig for exercise demos.
//
// Poses say where the hip and ankles are; knees are solved with two-bone IK,
// so feet stay planted where you put them. Torso and arms use absolute angles.
// Angle convention: 0° = straight up, 90° = forward (+x), 180° = straight down.

export type Vec = [number, number];
export type KneeBias = "f" | "b" | "u" | "d" | "l" | "r";

export interface LegPose {
  ankle: Vec;
  /** Foot direction from ankle to toe (90 = flat, pointing forward). */
  foot: number;
  /** Which way the knee should bend. */
  knee: KneeBias;
}

export interface Pose {
  hip: Vec;
  torso: number;
  /** Near leg (drawn dark) and far leg (drawn light). */
  a: LegPose;
  b: LegPose;
  /** [upper arm, forearm] absolute angles. */
  armA: [number, number];
  armB: [number, number];
}

export const BONES = {
  thigh: 18,
  shin: 17,
  foot: 6,
  torso: 24,
  upperArm: 13,
  forearm: 12,
  neck: 4,
  head: 5,
};

export function dir(angle: number): Vec {
  const r = (angle * Math.PI) / 180;
  return [Math.sin(r), -Math.cos(r)];
}

function add(p: Vec, v: Vec, s = 1): Vec {
  return [p[0] + v[0] * s, p[1] + v[1] * s];
}

const BIAS: Record<KneeBias, Vec> = { f: [1, 0], b: [-1, 0], u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

/** Two-bone IK: where the knee goes between hip and ankle. */
export function solveKnee(hip: Vec, ankle: Vec, bias: KneeBias): Vec {
  const a = BONES.thigh;
  const b = BONES.shin;
  const dx = ankle[0] - hip[0];
  const dy = ankle[1] - hip[1];
  const d = Math.min(Math.max(Math.hypot(dx, dy), 0.001), a + b - 0.01);
  const base = Math.atan2(dy, dx);
  const cos = (a * a + d * d - b * b) / (2 * a * d);
  const alpha = Math.acos(Math.max(-1, Math.min(1, cos)));
  const k1: Vec = [hip[0] + a * Math.cos(base + alpha), hip[1] + a * Math.sin(base + alpha)];
  const k2: Vec = [hip[0] + a * Math.cos(base - alpha), hip[1] + a * Math.sin(base - alpha)];
  const mid: Vec = [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2];
  const pref = BIAS[bias];
  const score = (k: Vec) => (k[0] - mid[0]) * pref[0] + (k[1] - mid[1]) * pref[1];
  return score(k1) >= score(k2) ? k1 : k2;
}

export interface Skeleton {
  hipA: Vec;
  hipB: Vec;
  shoulderA: Vec;
  shoulderB: Vec;
  head: Vec;
  legA: [Vec, Vec, Vec, Vec]; // hip, knee, ankle, toe
  legB: [Vec, Vec, Vec, Vec];
  armA: [Vec, Vec, Vec]; // shoulder, elbow, hand
  armB: [Vec, Vec, Vec];
}

/**
 * Front view spreads the hips and shoulders sideways; side view stacks them.
 * In front view, leg A is the runner's right leg (left of screen).
 */
export function solve(p: Pose, view: "side" | "front" = "side"): Skeleton {
  const hipSpread = view === "front" ? 5 : 0;
  const shoulderSpread = view === "front" ? 8 : 0;
  const shoulder = add(p.hip, dir(p.torso), BONES.torso);
  const across: Vec = [Math.cos((p.torso * Math.PI) / 180), Math.sin((p.torso * Math.PI) / 180)];
  const hipA = add(p.hip, across, -hipSpread);
  const hipB = add(p.hip, across, hipSpread);
  const shoulderA = add(shoulder, across, -shoulderSpread);
  const shoulderB = add(shoulder, across, shoulderSpread);
  const head = add(shoulder, dir(p.torso), BONES.neck + BONES.head);

  const leg = (hip: Vec, l: LegPose): [Vec, Vec, Vec, Vec] => {
    const knee = solveKnee(hip, l.ankle, l.knee);
    return [hip, knee, l.ankle, add(l.ankle, dir(l.foot), BONES.foot)];
  };
  const arm = (s: Vec, [u, f]: [number, number]): [Vec, Vec, Vec] => {
    const elbow = add(s, dir(u), BONES.upperArm);
    return [s, elbow, add(elbow, dir(f), BONES.forearm)];
  };

  return {
    hipA,
    hipB,
    shoulderA,
    shoulderB,
    head,
    legA: leg(hipA, p.a),
    legB: leg(hipB, p.b),
    armA: arm(shoulderA, p.armA),
    armB: arm(shoulderB, p.armB),
  };
}

// ---------------------------------------------------------------------------
// Interpolation

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec, b: Vec, t: number): Vec => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
/** Angles take the short way around. */
const lerpAngle = (a: number, b: number, t: number) => {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return a + d * t;
};
const lerpLeg = (a: LegPose, b: LegPose, t: number): LegPose => ({
  ankle: lerpV(a.ankle, b.ankle, t),
  foot: lerpAngle(a.foot, b.foot, t),
  knee: t < 0.5 ? a.knee : b.knee,
});

export function blend(a: Pose, b: Pose, t: number): Pose {
  return {
    hip: lerpV(a.hip, b.hip, t),
    torso: lerpAngle(a.torso, b.torso, t),
    a: lerpLeg(a.a, b.a, t),
    b: lerpLeg(a.b, b.b, t),
    armA: [lerpAngle(a.armA[0], b.armA[0], t), lerpAngle(a.armA[1], b.armA[1], t)],
    armB: [lerpAngle(a.armB[0], b.armB[0], t), lerpAngle(a.armB[1], b.armB[1], t)],
  };
}

export const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
