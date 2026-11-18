"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { embedFor, isHold, patternFor } from "@/lib/demo/match";
import { cycleLength, GROUND, poseAt, type Pattern, type Prop } from "@/lib/demo/patterns";
import { blend, BONES, easeInOut, solve, type Pose, type Skeleton, type Vec } from "@/lib/demo/rig";
import type { Exercise } from "@/lib/types";

/** In-app demo: an embedded video when the exercise has a direct link, otherwise an animation. */
export function ExerciseDemo({ exercise, size = "sm" }: { exercise: Exercise; size?: "sm" | "lg" }) {
  const embed = embedFor(exercise.video_url);
  if (embed) {
    return (
      <div className="mx-auto overflow-hidden rounded-xl bg-black" style={{ aspectRatio: embed.aspect, maxHeight: "70dvh" }}>
        <iframe
          src={embed.src}
          title={`${exercise.name} video`}
          className="h-full w-full"
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
        />
      </div>
    );
  }
  return <Animation pattern={patternFor(exercise)} hold={isHold(exercise)} label={exercise.name} size={size} />;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function Animation({
  pattern,
  hold,
  label,
  frame,
  size = "sm",
}: {
  pattern: Pattern;
  hold?: boolean;
  label: string;
  frame?: number;
  size?: "sm" | "lg";
}) {
  const reduced = usePrefersReducedMotion();
  const still = reduced || frame !== undefined;
  const [t, setT] = useState(0);

  useEffect(() => {
    if (still) return;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      setT((now - start) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  const trail = useMemo(() => (hold ? null : motionTrail(pattern)), [pattern, hold]);
  const pose = hold
    ? breathe(pattern.frames[pattern.holdFrame].pose, still ? 0 : t)
    : still
      ? pattern.frames[frame ?? pattern.holdFrame].pose
      : poseAt(pattern, t, blend, easeInOut);

  return (
    <div className={`relative overflow-hidden rounded-xl bg-card ${size === "lg" ? "h-full" : ""}`}>
      <Scene pattern={pattern} pose={pose} trail={trail} label={label} className={`mx-auto block w-full ${size === "lg" ? "h-full" : "h-44"}`} />
      {hold && (
        <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-ink">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-ink" aria-hidden />
          Hold
        </span>
      )}
    </div>
  );
}

/** Holds aren't frozen: the chest rises and falls a little, like breathing. */
function breathe(p: Pose, t: number): Pose {
  if (!t) return p;
  const s = Math.sin((t / 3.6) * Math.PI * 2);
  return { ...p, torso: p.torso + s * 1.1, hip: [p.hip[0], p.hip[1] - s * 0.25] };
}

/** The path of whichever joint moves most during the loop (hand, hip, foot or head). */
function motionTrail(p: Pattern): Vec[] | null {
  const total = cycleLength(p);
  const pick = (k: Skeleton): Vec[] => [k.armA[2], mid(k.hipA, k.hipB), k.legB[2], k.head];
  const samples: Vec[][] = [];
  for (let i = 0; i <= 48; i++) samples.push(pick(solve(poseAt(p, (i / 48) * total, blend, easeInOut), p.view)));
  let best = -1;
  let bestLen = 0;
  for (let j = 0; j < 4; j++) {
    let len = 0;
    for (let i = 1; i < samples.length; i++) len += dist(samples[i][j], samples[i - 1][j]);
    if (len > bestLen) {
      bestLen = len;
      best = j;
    }
  }
  return bestLen > 14 && best >= 0 ? samples.map((s) => s[best]) : null;
}

// ---------------------------------------------------------------------------
// Geometry

const mid = (a: Vec, b: Vec): Vec => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
const dist = (a: Vec, b: Vec) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const pts = (ps: Vec[]) => ps.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ");
const r2 = (n: number) => n.toFixed(2);

/** Light comes from the upper left. */
const LIGHT: Vec = [-0.55, -0.83];

/** Unit normal of a segment, flipped to face the light. */
function litNormal(a: Vec, b: Vec): Vec {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l = Math.hypot(dx, dy) || 1;
  const n: Vec = [-dy / l, dx / l];
  return n[0] * LIGHT[0] + n[1] * LIGHT[1] >= 0 ? n : [-n[0], -n[1]];
}

const off = (p: Vec, n: Vec, s: number): Vec => [p[0] + n[0] * s, p[1] + n[1] * s];

// ---------------------------------------------------------------------------
// Drawing

const SKIN_NEAR = "var(--text)";
const SKIN_FAR = "var(--muted)";
const SHIRT = "var(--accent)";
const SHORTS = "#4b5870";
const METAL = { face: "#a3a9b0", rim: "#5d636b", hub: "#2a2d31" };

/** A rounded limb segment, shaded like a cylinder: a highlight toward the light, a shadow away from it. */
function Segment({ a, b, w, color, far }: { a: Vec; b: Vec; w: number; color: string; far?: boolean }) {
  const n = litNormal(a, b);
  const hi = w * 0.24;
  return (
    <g>
      <line x1={r2(a[0])} y1={r2(a[1])} x2={r2(b[0])} y2={r2(b[1])} stroke={color} strokeWidth={w} strokeLinecap="round" />
      <line
        x1={r2(off(a, n, -hi)[0])}
        y1={r2(off(a, n, -hi)[1])}
        x2={r2(off(b, n, -hi)[0])}
        y2={r2(off(b, n, -hi)[1])}
        stroke="#000"
        strokeOpacity={far ? 0.28 : 0.22}
        strokeWidth={w * 0.36}
        strokeLinecap="round"
      />
      <line
        x1={r2(off(a, n, hi)[0])}
        y1={r2(off(a, n, hi)[1])}
        x2={r2(off(b, n, hi)[0])}
        y2={r2(off(b, n, hi)[1])}
        stroke="#fff"
        strokeOpacity={far ? 0.16 : 0.38}
        strokeWidth={w * 0.3}
        strokeLinecap="round"
      />
    </g>
  );
}

function Leg({ leg, far }: { leg: Skeleton["legA"]; far?: boolean }) {
  const c = far ? SKIN_FAR : SKIN_NEAR;
  const [hip, knee, ankle, toe] = leg;
  return (
    <g>
      <Segment a={ankle} b={toe} w={3.2} color={c} far={far} />
      <Segment a={knee} b={ankle} w={4.3} color={c} far={far} />
      <Segment a={hip} b={knee} w={5.6} color={c} far={far} />
      <Segment a={hip} b={[hip[0] + (knee[0] - hip[0]) * 0.45, hip[1] + (knee[1] - hip[1]) * 0.45]} w={6.6} color={SHORTS} far={far} />
    </g>
  );
}

function Arm({ arm, far, props }: { arm: Skeleton["armA"]; far?: boolean; props?: Prop[] }) {
  const c = far ? SKIN_FAR : SKIN_NEAR;
  const [shoulder, elbow, hand] = arm;
  // Short sleeve: the top third of the upper arm is shirt.
  const sleeve: Vec = [shoulder[0] + (elbow[0] - shoulder[0]) * 0.38, shoulder[1] + (elbow[1] - shoulder[1]) * 0.38];
  return (
    <g>
      <Segment a={shoulder} b={elbow} w={3.9} color={c} far={far} />
      <Segment a={shoulder} b={sleeve} w={4.5} color={SHIRT} far={far} />
      <Segment a={elbow} b={hand} w={3.3} color={c} far={far} />
      <circle cx={r2(hand[0])} cy={r2(hand[1])} r={2} fill={c} />
      {props?.some((p) => p.kind === "dumbbells") && <PlateEnd at={hand} r={3} dim={far} />}
    </g>
  );
}

/** A weight seen end-on: a rim for its thickness, the face, and the hub. */
function PlateEnd({ at, r, dim }: { at: Vec; r: number; dim?: boolean }) {
  const d = r * 0.28;
  return (
    <g opacity={dim ? 0.7 : 1}>
      <circle cx={r2(at[0] + d)} cy={r2(at[1] + d * 0.8)} r={r} fill={METAL.rim} />
      <circle cx={r2(at[0])} cy={r2(at[1])} r={r} fill={METAL.face} />
      <circle cx={r2(at[0] - r * 0.25)} cy={r2(at[1] - r * 0.3)} r={r * 0.55} fill="#fff" opacity="0.22" />
      <circle cx={r2(at[0])} cy={r2(at[1])} r={Math.max(0.9, r * 0.22)} fill={METAL.hub} />
    </g>
  );
}

function Torso({ sk, front, gid }: { sk: Skeleton; front: boolean; gid: string }) {
  const hip = mid(sk.hipA, sk.hipB);
  const sh = mid(sk.shoulderA, sk.shoulderB);
  const n = litNormal(hip, sh);
  // Side view: chest a little deeper than the waist. Front view: shoulders wider than hips.
  const wHip = front ? dist(sk.hipA, sk.hipB) / 2 + 0.8 : 4.1;
  const wSh = front ? dist(sk.shoulderA, sk.shoulderB) / 2 : 5.4;
  const neckBase = off(sh, [sh[0] - hip[0], sh[1] - hip[1]].map((v) => v / (dist(hip, sh) || 1)) as Vec, 0.6);
  const poly = [off(hip, n, wHip), off(sh, n, wSh), off(sh, n, -wSh), off(hip, n, -wHip)];
  const c = mid(hip, sh);
  const g1 = off(c, n, -wSh);
  const g2 = off(c, n, wSh);
  return (
    <g>
      <defs>
        <linearGradient id={gid} gradientUnits="userSpaceOnUse" x1={r2(g1[0])} y1={r2(g1[1])} x2={r2(g2[0])} y2={r2(g2[1])}>
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      {/* Neck */}
      <Segment a={neckBase} b={sk.head} w={3} color={SKIN_NEAR} />
      {[SHIRT, `url(#${gid})`].map((fill) => (
        <g key={fill} fill={fill}>
          <polygon points={pts(poly)} stroke={fill} strokeWidth="2.4" strokeLinejoin="round" />
          {/* Rounded shoulders */}
          {front ? (
            [sk.shoulderA, sk.shoulderB].map((p, i) => <circle key={i} cx={r2(p[0])} cy={r2(p[1])} r="2.6" />)
          ) : (
            <circle cx={r2(sh[0])} cy={r2(sh[1])} r={r2(wSh + 0.6)} />
          )}
        </g>
      ))}
      {/* Waistband */}
      <line
        x1={r2(off(hip, n, wHip + 0.6)[0])}
        y1={r2(off(hip, n, wHip + 0.6)[1])}
        x2={r2(off(hip, n, -wHip - 0.6)[0])}
        y2={r2(off(hip, n, -wHip - 0.6)[1])}
        stroke="#000"
        strokeOpacity="0.35"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
  );
}

function Head({ at, gid }: { at: Vec; gid: string }) {
  const r = BONES.head + 0.3;
  return (
    <g>
      <defs>
        <radialGradient id={gid} cx="0.36" cy="0.3" r="0.75">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="0.45" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.8" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.38" />
        </radialGradient>
      </defs>
      <circle cx={r2(at[0])} cy={r2(at[1])} r={r} fill={SKIN_NEAR} />
      <circle cx={r2(at[0])} cy={r2(at[1])} r={r} fill={`url(#${gid})`} />
    </g>
  );
}

function Figure({ sk, front, props, ids }: { sk: Skeleton; front: boolean; props?: Prop[]; ids: { torso: string; head: string } }) {
  // Keep the head above the floor in lying positions.
  const head: Vec = [sk.head[0], Math.min(sk.head[1], GROUND - BONES.head)];
  const sk2 = { ...sk, head };
  if (front) {
    return (
      <g>
        <Leg leg={sk.legB} />
        <Leg leg={sk.legA} />
        <Torso sk={sk2} front gid={ids.torso} />
        <Head at={head} gid={ids.head} />
        <Arm arm={sk.armB} props={props} />
        <Arm arm={sk.armA} props={props} />
      </g>
    );
  }
  return (
    <g>
      <Leg leg={sk.legB} far />
      <Arm arm={sk.armB} far props={props} />
      <Torso sk={sk2} front={false} gid={ids.torso} />
      <Head at={head} gid={ids.head} />
      <Leg leg={sk.legA} />
      <Arm arm={sk.armA} props={props} />
    </g>
  );
}

/** A box or bench with a top and a side, so it has depth. */
function Box({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const dx = 4;
  const dy = -3;
  return (
    <g strokeLinejoin="round">
      <polygon points={pts([[x, y], [x + w, y], [x + w + dx, y + dy], [x + dx, y + dy]])} fill="var(--border)" />
      <polygon points={pts([[x, y], [x + w, y], [x + w + dx, y + dy], [x + dx, y + dy]])} fill="#fff" opacity="0.14" />
      <polygon points={pts([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]])} fill="var(--border)" />
      <polygon points={pts([[x + w, y], [x + w + dx, y + dy], [x + w + dx, y + h + dy], [x + w, y + h]])} fill="#000" opacity="0.22" />
      <rect x={x} y={y} width={w} height={h} fill="var(--border)" />
      <rect x={x} y={y} width={w} height={h} fill="#000" opacity="0.06" />
      <line x1={x} x2={x + w} y1={y + 0.4} y2={y + 0.4} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.8" />
    </g>
  );
}

function PropBehind({ prop }: { prop: Prop }) {
  switch (prop.kind) {
    case "box":
      return <Box x={prop.x} y={prop.y} w={prop.w} h={prop.h} />;
    case "strap":
      return (
        <g>
          <Box x={prop.x - 5} y={GROUND - 4} w={10} h={4} />
          <rect x={prop.x - 2.5} y={GROUND - 7} width="5" height="3.5" rx="1.2" fill={SHIRT} opacity="0.9" />
        </g>
      );
    case "bandFoot":
      return <Box x={prop.to[0] - 3} y={prop.to[1] - 6} w={5} h={GROUND - prop.to[1] + 6} />;
    default:
      return null;
  }
}

function PropFront({ prop, sk }: { prop: Prop; sk: Skeleton }) {
  switch (prop.kind) {
    case "barBack":
      return <PlateEnd at={[sk.shoulderA[0] - 2, sk.shoulderA[1] + 1]} r={6.5} />;
    case "barHands":
      return <PlateEnd at={sk.armA[2]} r={6.5} />;
    case "bandFoot": {
      const a = sk.legB[2];
      return (
        <g strokeLinecap="round">
          <line x1={r2(a[0])} y1={r2(a[1])} x2={prop.to[0]} y2={prop.to[1]} stroke={SHIRT} strokeWidth="1.8" />
          <line x1={r2(a[0])} y1={r2(a[1] - 0.4)} x2={prop.to[0]} y2={prop.to[1] - 0.4} stroke="#fff" strokeOpacity="0.35" strokeWidth="0.5" />
        </g>
      );
    }
    case "bandKnees": {
      const k1 = sk.legA[1];
      const k2 = sk.legB[1];
      return (
        <g strokeLinecap="round">
          <line x1={r2(k1[0])} y1={r2(k1[1] + 2)} x2={r2(k2[0])} y2={r2(k2[1] + 2)} stroke={SHIRT} strokeWidth="2.2" />
          <line x1={r2(k1[0])} y1={r2(k1[1] + 1.5)} x2={r2(k2[0])} y2={r2(k2[1] + 1.5)} stroke="#fff" strokeOpacity="0.35" strokeWidth="0.6" />
        </g>
      );
    }
    default:
      return null;
  }
}

/** Floor with perspective lines, and a soft shadow that shrinks and fades as the body leaves the ground. */
function Floor({ sk, gid }: { sk: Skeleton; gid: string }) {
  const all: Vec[] = [...sk.legA, ...sk.legB, ...sk.armA, ...sk.armB, sk.head, sk.hipA, sk.hipB];
  const xs = all.map((p) => p[0]);
  const lowest = Math.max(...all.map((p) => p[1]));
  const gap = Math.max(0, GROUND - 1 - lowest);
  const lift = Math.min(1, gap / 22);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const rx = ((Math.max(...xs) - Math.min(...xs)) / 2 + 4) * (1 - lift * 0.35);
  const vp: Vec = [60, 18];
  const rays = [-80, -40, 0, 40, 80, 120, 160, 200];
  return (
    <g>
      <defs>
        <linearGradient id={`${gid}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--border)" stopOpacity="0.9" />
          <stop offset="1" stopColor="var(--border)" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${gid}s`}>
          <stop offset="0" stopColor="#000" stopOpacity="0.75" />
          <stop offset="1" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${gid}c`}>
          <rect x="0" y={GROUND} width="120" height="12" />
        </clipPath>
      </defs>
      <rect x="0" y={GROUND} width="120" height="12" fill={`url(#${gid}f)`} />
      <g clipPath={`url(#${gid}c)`} stroke="var(--muted)" strokeOpacity="0.16" strokeWidth="0.4">
        {rays.map((x) => (
          <line key={x} x1={vp[0]} y1={vp[1]} x2={x} y2={GROUND + 40} />
        ))}
        {[2.2, 5, 8.6].map((d) => (
          <line key={d} x1="0" x2="120" y1={GROUND + d} y2={GROUND + d} />
        ))}
      </g>
      <line x1="0" x2="120" y1={GROUND} y2={GROUND} stroke="var(--muted)" strokeOpacity="0.35" strokeWidth="0.5" />
      <ellipse cx={r2(cx)} cy={GROUND + 0.8} rx={r2(rx)} ry={r2(2.8 - lift)} fill={`url(#${gid}s)`} opacity={r2(0.9 - lift * 0.55)} />
    </g>
  );
}

/** The whole picture for one pose. No hooks except ids, so it can be drawn for any frame. */
export function Scene({
  pattern,
  pose,
  trail,
  label,
  className,
}: {
  pattern: Pattern;
  pose: Pose;
  trail?: Vec[] | null;
  label: string;
  className?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const sk = solve(pose, pattern.view);
  const front = pattern.view === "front";
  return (
    <svg viewBox="0 -14 120 104" className={className} role="img" aria-label={`${label} demo`}>
      <defs>
        <radialGradient id={`${uid}bg`} cx="0.5" cy="0.42" r="0.65">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.1" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="0" y="-14" width="120" height="104" fill={`url(#${uid}bg)`} />
      <Floor sk={sk} gid={`${uid}fl`} />
      {pattern.props?.map((p, i) => <PropBehind key={i} prop={p} />)}
      {trail && (
        <polyline
          points={pts(trail)}
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.45"
          strokeWidth="0.9"
          strokeDasharray="1.2 1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      <Figure sk={sk} front={front} props={pattern.props} ids={{ torso: `${uid}t`, head: `${uid}h` }} />
      {pattern.props?.map((p, i) => <PropFront key={i} prop={p} sk={sk} />)}
    </svg>
  );
}
