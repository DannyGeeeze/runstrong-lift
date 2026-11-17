"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { buildSteps, formatClock, type LiveStep } from "@/lib/live";
import type { Workout } from "@/lib/rules";
import { ExerciseDemo } from "./ExerciseDemo";

type Timer = { phase: "idle" } | { phase: "countdown" | "running"; endAt: number; total: number };

// ---------------------------------------------------------------------------
// Sound, vibration and keeping the screen awake

function useBeeper() {
  const ctx = useRef<AudioContext | null>(null);
  // Browsers only allow audio after a tap, so every button calls unlock().
  const unlock = useCallback(() => {
    if (ctx.current) return;
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx.current = new AC();
    } catch {
      ctx.current = null;
    }
  }, []);
  const beep = useCallback((freq = 880, ms = 120) => {
    const c = ctx.current;
    if (c) {
      if (c.state === "suspended") void c.resume();
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.3, c.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + ms / 1000);
      osc.connect(gain).connect(c.destination);
      osc.start();
      osc.stop(c.currentTime + ms / 1000 + 0.02);
    }
    try {
      navigator.vibrate?.(ms >= 300 ? [200, 80, 200] : 60);
    } catch {
      // not supported (iPhone)
    }
  }, []);
  return { unlock, beep };
}

function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const request = async () => {
      try {
        lock = (await nav.wakeLock?.request("screen")) ?? null;
      } catch {
        lock = null;
      }
    };
    void request();
    const onVisible = () => document.visibilityState === "visible" && void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, []);
}

// ---------------------------------------------------------------------------

export function LiveWorkout({
  workout,
  onClose,
  onFinish,
}: {
  workout: Workout;
  onClose: () => void;
  onFinish: (doneIds: string[]) => void;
}) {
  const steps = useMemo(() => buildSteps(workout.items, workout.warmup), [workout]);
  const [index, setIndex] = useState(0);
  const [timer, setTimer] = useState<Timer>({ phase: "idle" });
  const [done, setDone] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(Date.now());
  const lastBeep = useRef<number | null>(null);
  // Each timer finishes exactly once, even if React re-runs the effect before the next step loads.
  const firedFor = useRef<number | null>(null);
  const { unlock, beep } = useBeeper();
  useWakeLock();

  const finished = index >= steps.length;
  const step = steps[index] as LiveStep | undefined;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Rests start on their own when you reach them.
  useEffect(() => {
    lastBeep.current = null;
    if (step?.kind === "rest") {
      setTimer({ phase: "running", endAt: Date.now() + step.seconds * 1000, total: step.seconds });
    } else {
      setTimer({ phase: "idle" });
    }
  }, [index, step]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, steps.length)), [steps.length]);

  const completeWork = useCallback(() => {
    if (step?.kind === "work") {
      const id = workout.items[step.item].exercise.id;
      setDone((d) => new Set(d).add(id));
    }
    next();
  }, [step, workout.items, next]);

  const remaining = timer.phase === "idle" ? 0 : Math.max(0, Math.ceil((timer.endAt - now) / 1000));

  // Tick beeps for the last 3 seconds, a long beep at zero, then move on.
  useEffect(() => {
    if (timer.phase === "idle") return;
    if (remaining > 0 && remaining <= 3 && lastBeep.current !== remaining) {
      lastBeep.current = remaining;
      beep(660, 90);
    }
    if (remaining > 0) return;
    if (firedFor.current === timer.endAt) return;
    firedFor.current = timer.endAt;
    if (timer.phase === "countdown" && step?.kind === "work" && step.seconds) {
      beep(990, 160);
      lastBeep.current = null;
      setTimer({ phase: "running", endAt: Date.now() + step.seconds * 1000, total: step.seconds });
    } else if (timer.phase === "running") {
      beep(990, 350);
      if (step?.kind === "work") completeWork();
      else next();
    }
  }, [remaining, timer, step, beep, completeWork, next]);

  const tap = (fn: () => void) => () => {
    unlock();
    fn();
  };

  function exit() {
    if (done.size === 0 || confirm("End the workout? Nothing will be saved.")) onClose();
  }

  const elapsed = (now - startedAt.current) / 1000;
  const progress = Math.min(1, index / steps.length);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 min-h-0">
        {/* Top bar */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={exit} aria-label="End workout" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-muted">
            ×
          </button>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="w-12 text-right font-mono text-sm tabular-nums text-muted">{formatClock(elapsed)}</span>
        </div>

        {finished ? (
          <FinishView elapsed={elapsed} done={done.size} total={workout.items.length} />
        ) : step?.kind === "warmup" ? (
          <div key={index} className="animate-rise flex flex-1 flex-col justify-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Warm-up</p>
            <ul className="mt-4 space-y-3 text-lg">
              {step.lines.map((l) => (
                <li key={l} className="flex gap-3">
                  <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ) : step?.kind === "work" ? (
          <WorkView key={index} workout={workout} step={step} timer={timer} remaining={remaining} />
        ) : step?.kind === "rest" ? (
          <RestView key={index} workout={workout} step={step} remaining={remaining} total={timer.phase === "idle" ? step.seconds : timer.total} nextStep={steps[index + 1]} />
        ) : null}

        {/* Bottom actions */}
        <div className="mt-4 space-y-2">
          {finished ? (
            <>
              <button type="button" onClick={() => onFinish([...done])} className="w-full rounded-2xl bg-accent py-4 text-lg font-semibold text-accent-ink active:scale-[0.99]">
                Save workout
              </button>
              <button type="button" onClick={onClose} className="w-full py-2 text-sm text-muted">
                Close without saving
              </button>
            </>
          ) : (
            <>
              {step?.kind === "warmup" && <Primary onClick={tap(next)}>Start lifting</Primary>}
              {step?.kind === "work" && step.seconds === null && <Primary onClick={tap(completeWork)}>Done</Primary>}
              {step?.kind === "work" && step.seconds !== null && timer.phase === "idle" && (
                <Primary onClick={tap(() => setTimer({ phase: "countdown", endAt: Date.now() + 3000, total: 3 }))}>Start {step.seconds} s</Primary>
              )}
              {step?.kind === "work" && step.seconds !== null && timer.phase !== "idle" && (
                <Primary secondary onClick={tap(completeWork)}>Skip timer</Primary>
              )}
              {step?.kind === "rest" && (
                <div className="grid grid-cols-2 gap-2">
                  <Primary
                    secondary
                    onClick={tap(() => setTimer((t) => (t.phase === "idle" ? t : { ...t, endAt: t.endAt + 15000, total: t.total + 15 })))}
                  >
                    +15 s
                  </Primary>
                  <Primary onClick={tap(next)}>Skip rest</Primary>
                </div>
              )}
              <div className="flex justify-between text-sm text-muted">
                <button type="button" className="py-2 disabled:opacity-30" disabled={index === 0} onClick={tap(() => setIndex((i) => Math.max(0, i - 1)))}>
                  ‹ Back
                </button>
                <button type="button" className="py-2" onClick={tap(next)}>
                  Skip ›
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function WorkView({ workout, step, timer, remaining }: { workout: Workout; step: Extract<LiveStep, { kind: "work" }>; timer: Timer; remaining: number }) {
  const p = workout.items[step.item];
  const timed = step.seconds !== null && timer.phase !== "idle";
  return (
    <div className="animate-rise flex min-h-0 flex-1 flex-col pt-4">
      <p className="text-sm font-semibold text-muted">
        <span className="mr-2 rounded-md bg-card-2 px-1.5 py-0.5 text-xs font-bold text-ink">{p.slot}</span>
        Set {step.set} of {step.sets}
        {step.side && <span className="text-accent"> · {step.side === "left" ? "Left" : "Right"} side</span>}
      </p>
      <h1 className="mt-1 text-2xl font-bold leading-tight">{p.exercise.name}</h1>

      <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-2xl bg-card">
        <div className="absolute inset-0">
          <ExerciseDemo exercise={p.exercise} size="lg" />
        </div>
        {timed && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-sm">
            {timer.phase === "countdown" ? (
              <span key={remaining} className="animate-rise text-8xl font-bold text-accent">{remaining}</span>
            ) : (
              <Ring value={remaining} total={timer.phase === "running" ? timer.total : 1} label={/hold|iso/i.test(`${p.reps} ${p.exercise.name}`) ? "Hold" : "Go"} />
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-4xl font-bold tracking-tight">{step.seconds !== null ? `${step.seconds} s` : step.reps}</p>
        {p.note && <p className="max-w-[55%] text-right text-xs font-medium text-muted">{p.note}</p>}
      </div>
      <p className="mt-1 text-sm text-muted">{p.cue}</p>
    </div>
  );
}

function RestView({
  workout,
  step,
  remaining,
  total,
  nextStep,
}: {
  workout: Workout;
  step: Extract<LiveStep, { kind: "rest" }>;
  remaining: number;
  total: number;
  nextStep: LiveStep | undefined;
}) {
  const up = nextStep?.kind === "work" ? nextStep : null;
  const upItem = up ? workout.items[up.item] : null;
  return (
    <div className="animate-rise flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
      <Ring value={remaining} total={total} label={step.label} big />
      {up && upItem && (
        <div className="flex w-full items-center gap-3 rounded-2xl border border-line bg-card p-3">
          <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg">
            <ExerciseDemo exercise={upItem.exercise} size="lg" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Up next</p>
            <p className="truncate font-semibold">{upItem.exercise.name}</p>
            <p className="text-sm text-muted">
              Set {up.set} of {up.sets} · {up.seconds !== null ? `${up.seconds} s` : up.reps}
              {up.side ? ` · ${up.side}` : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FinishView({ elapsed, done, total }: { elapsed: number; done: number; total: number }) {
  return (
    <div className="animate-rise flex flex-1 flex-col items-center justify-center text-center">
      <p className="text-6xl">💪</p>
      <h1 className="mt-4 text-3xl font-bold">Workout done</h1>
      <div className="mt-6 grid w-full grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-3xl font-bold tabular-nums">{formatClock(elapsed)}</p>
          <p className="text-xs text-muted">time</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="text-3xl font-bold tabular-nums">
            {done}/{total}
          </p>
          <p className="text-xs text-muted">exercises</p>
        </div>
      </div>
    </div>
  );
}

function Ring({ value, total, label, big }: { value: number; total: number; label: string; big?: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <div className={`relative ${big ? "h-64 w-64" : "h-44 w-44"}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 0.25s linear" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold tabular-nums ${big ? "text-6xl" : "text-5xl"}`}>{formatClock(value)}</span>
        {label && <span className="mt-1 text-sm font-semibold uppercase tracking-wider text-muted">{label}</span>}
      </div>
    </div>
  );
}

function Primary({ children, onClick, secondary }: { children: React.ReactNode; onClick: () => void; secondary?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl py-4 text-lg font-semibold transition active:scale-[0.99] ${
        secondary ? "border border-line bg-card-2 text-ink" : "bg-accent text-accent-ink"
      }`}
    >
      {children}
    </button>
  );
}
