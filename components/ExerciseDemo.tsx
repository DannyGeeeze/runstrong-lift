"use client";

import { useEffect, useState } from "react";
import { embedFor, isHold, patternFor } from "@/lib/demo/match";
import { GROUND, poseAt, type Pattern, type Prop } from "@/lib/demo/patterns";
import { blend, BONES, easeInOut, solve, type Skeleton, type Vec } from "@/lib/demo/rig";
import type { Exercise } from "@/lib/types";

/** In-app demo: an embedded video when the exercise has a direct link, otherwise an animation. */
export function ExerciseDemo({ exercise }: { exercise: Exercise }) {
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
  return <Animation pattern={patternFor(exercise)} hold={isHold(exercise)} label={exercise.name} />;
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

export function Animation({ pattern, hold, label, frame }: { pattern: Pattern; hold?: boolean; label: string; frame?: number }) {
  const reduced = usePrefersReducedMotion();
  const still = hold || reduced || frame !== undefined;
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

  const pose = still ? pattern.frames[frame ?? pattern.holdFrame].pose : poseAt(pattern, t, blend, easeInOut);
  const sk = solve(pose, pattern.view);

  return (
    <div className="relative overflow-hidden rounded-xl bg-card">
      <svg viewBox="0 -14 120 104" className="mx-auto block h-44 w-full" role="img" aria-label={`${label} demo`}>
        <line x1="4" x2="116" y1={GROUND + 0.8} y2={GROUND + 0.8} stroke="var(--border)" strokeWidth="1.2" strokeLinecap="round" />
        {pattern.props?.map((p, i) => <PropShape key={i} prop={p} sk={sk} under />)}
        <Figure sk={sk} />
        {pattern.props?.map((p, i) => <PropShape key={i} prop={p} sk={sk} />)}
      </svg>
      {hold && (
        <span className="absolute right-2 top-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-ink">
          Hold
        </span>
      )}
    </div>
  );
}

const pts = (ps: Vec[]) => ps.map((p) => p.join(",")).join(" ");

function Limb({ points, far }: { points: Vec[]; far?: boolean }) {
  return (
    <polyline
      points={pts(points)}
      fill="none"
      stroke={far ? "var(--muted)" : "var(--text)"}
      strokeOpacity={far ? 0.55 : 1}
      strokeWidth="3.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function Figure({ sk }: { sk: Skeleton }) {
  const hip: Vec = [(sk.hipA[0] + sk.hipB[0]) / 2, (sk.hipA[1] + sk.hipB[1]) / 2];
  const shoulder: Vec = [(sk.shoulderA[0] + sk.shoulderB[0]) / 2, (sk.shoulderA[1] + sk.shoulderB[1]) / 2];
  // Keep the head above the floor in lying positions.
  const head: Vec = [sk.head[0], Math.min(sk.head[1], GROUND - BONES.head)];
  return (
    <g>
      <Limb points={sk.legB} far />
      <Limb points={sk.armB} far />
      <Limb points={[sk.hipA, sk.hipB]} />
      <Limb points={[hip, shoulder]} />
      <Limb points={[sk.shoulderA, sk.shoulderB]} />
      <Limb points={sk.legA} />
      <Limb points={sk.armA} />
      <circle cx={head[0]} cy={head[1]} r={BONES.head} fill="var(--text)" />
    </g>
  );
}

function PropShape({ prop, sk, under }: { prop: Prop; sk: Skeleton; under?: boolean }) {
  const accent = "var(--accent)";
  // Boxes and straps sit behind the figure; weights and bands in front.
  const behind = prop.kind === "box" || prop.kind === "strap";
  if (behind !== !!under) return null;
  switch (prop.kind) {
    case "box":
      return <rect x={prop.x} y={prop.y} width={prop.w} height={prop.h} rx="1.5" fill="var(--border)" stroke="var(--muted)" strokeOpacity="0.5" strokeWidth="1" />;
    case "strap":
      return <rect x={prop.x - 4} y={GROUND - 5} width="8" height="5" rx="1" fill={accent} opacity="0.8" />;
    case "barBack": {
      const s = sk.shoulderA;
      return <circle cx={s[0] - 2} cy={s[1] + 1} r="6.5" fill="none" stroke={accent} strokeWidth="2.6" />;
    }
    case "barHands": {
      const h = sk.armA[2];
      return <circle cx={h[0]} cy={h[1]} r="6.5" fill="none" stroke={accent} strokeWidth="2.6" />;
    }
    case "dumbbells":
      return (
        <g fill={accent}>
          {[sk.armA[2], sk.armB[2]].map((h, i) => (
            <rect key={i} x={h[0] - 3.5} y={h[1] - 1.8} width="7" height="3.6" rx="1.4" opacity={i ? 0.55 : 1} />
          ))}
        </g>
      );
    case "bandFoot": {
      const a = sk.legB[2];
      return <line x1={a[0]} y1={a[1]} x2={prop.to[0]} y2={prop.to[1]} stroke={accent} strokeWidth="1.4" strokeLinecap="round" />;
    }
    case "bandKnees": {
      const k1 = sk.legA[1];
      const k2 = sk.legB[1];
      return <line x1={k1[0]} y1={k1[1] + 2} x2={k2[0]} y2={k2[1] + 2} stroke={accent} strokeWidth="2" strokeLinecap="round" />;
    }
  }
}
