"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { buildSteps, formatClock, type LiveStep } from "@/lib/live";
import type { Workout } from "@/lib/rules";
import { getExercise } from "@/lib/exercises";
import type { LiftLog } from "@/lib/types";
import { liveActivity, type ActivityState } from "@/lib/native";
import { formatWeights, isLoaded, lastTime, newBests, suggestWeight } from "@/lib/weights";
import { ExerciseDemo } from "./ExerciseDemo";

type Weights = Record<string, (number | null)[]>;

/**
 * Guided, full-screen workout player.
 * Layout: segmented progress + clock on top, the move's demo filling the top
 * half, the move and its reps/time in large type, one big ring for timed work
 * and rest, and thumb-reachable Back / main / Skip controls at the bottom.
 */

type Timer =
  | { phase: "idle" }
  | { phase: "countdown" | "running"; endAt: number; total: number; pausedLeft: number | null };

// ---------------------------------------------------------------------------
// Sound, vibration and keeping the screen awake

function useBeeper() {
  const ctx = useRef<AudioContext | null>(null);
  // Browsers only allow audio after a tap, so every control calls unlock().
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

/** Progress segments: warm-up, then one per exercise (rests belong to the exercise before them). */
function segmentsFor(steps: LiveStep[]) {
  const segOf: number[] = [];
  let lastItem = -1;
  for (const s of steps) {
    if (s.kind === "warmup") segOf.push(0);
    else if (s.kind === "work") {
      lastItem = s.item;
      segOf.push(s.item + 1);
    } else segOf.push(lastItem + 1);
  }
  const count = Math.max(0, ...segOf) + 1;
  return { segOf, count };
}

// ---------------------------------------------------------------------------

export function LiveWorkout({
  workout,
  history,
  onClose,
  onFinish,
}: {
  workout: Workout;
  history: LiftLog[];
  onClose: () => void;
  onFinish: (doneIds: string[], weights: Weights) => void;
}) {
  const steps = useMemo(() => buildSteps(workout.items, workout.warmup), [workout]);
  const { segOf, count } = useMemo(() => segmentsFor(steps), [steps]);
  const [index, setIndex] = useState(0);
  const [timer, setTimer] = useState<Timer>({ phase: "idle" });
  const [done, setDone] = useState<Set<string>>(new Set());
  const [setsDone, setSetsDone] = useState(0);
  const [weights, setWeights] = useState<Weights>({});
  /** Weight shown in the stepper for the current set (loaded rep sets only). */
  const [draft, setDraft] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const startedAt = useRef(Date.now());
  const pausedMs = useRef(0);
  const pausedAt = useRef<number | null>(null);
  const lastBeep = useRef<number | null>(null);
  // Each timer finishes exactly once, even if React re-runs the effect before the next step loads.
  const firedFor = useRef<number | null>(null);
  const { unlock, beep } = useBeeper();
  useWakeLock();

  const finished = index >= steps.length;
  const step = steps[index] as LiveStep | undefined;
  const paused = timer.phase !== "idle" && timer.pausedLeft !== null;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Rests and timed sets start on their own when you reach them (timed sets after a 3-2-1).
  // Rep-based sets wait for you to tap Done.
  useEffect(() => {
    lastBeep.current = null;
    if (step?.kind === "work" && step.seconds === null) {
      const ex = workout.items[step.item].exercise;
      setDraft(isLoaded(ex) ? (weights[ex.id]?.[step.set - 1] ?? suggestWeight(history, ex.id, step.set, weights[ex.id])) : null);
    }
    if (pausedAt.current) {
      pausedMs.current += Date.now() - pausedAt.current;
      pausedAt.current = null;
    }
    if (step?.kind === "rest") {
      setTimer({ phase: "running", endAt: Date.now() + step.seconds * 1000, total: step.seconds, pausedLeft: null });
    } else if (step?.kind === "work" && step.seconds !== null) {
      setTimer({ phase: "countdown", endAt: Date.now() + 3000, total: 3, pausedLeft: null });
    } else {
      setTimer({ phase: "idle" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, step]);

  const next = useCallback(() => setIndex((i) => Math.min(i + 1, steps.length)), [steps.length]);

  const completeWork = useCallback(() => {
    if (step?.kind === "work") {
      const ex = workout.items[step.item].exercise;
      const id = ex.id;
      setDone((d) => new Set(d).add(id));
      if (step.seconds === null && isLoaded(ex)) {
        setWeights((w) => {
          const sets = [...(w[id] ?? [])];
          sets[step.set - 1] = draft;
          return { ...w, [id]: sets };
        });
      }
      // Count a set once, not once per side.
      if (step.side !== "left") setSetsDone((n) => n + 1);
    }
    next();
  }, [step, workout.items, next, draft]);

  // Read the clock fresh on every render: the 200 ms tick only triggers re-renders. Using the
  // last tick's time made a just-started timer look up to 0.2 s longer (3-2-1 flashed a 4).
  // Never show more than the timer's own length either.
  const clock = Math.max(now, Date.now());
  const leftMs = timer.phase === "idle" ? 0 : timer.pausedLeft ?? timer.endAt - clock;
  const remaining = timer.phase === "idle" ? 0 : Math.min(timer.total, Math.max(0, Math.ceil(leftMs / 1000)));

  // Tick beeps for the last 3 seconds, a long beep at zero, then move on.
  useEffect(() => {
    if (timer.phase === "idle" || timer.pausedLeft !== null) return;
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
      setTimer({ phase: "running", endAt: Date.now() + step.seconds * 1000, total: step.seconds, pausedLeft: null });
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

  function togglePause() {
    if (timer.phase === "idle") return;
    if (timer.pausedLeft === null) {
      pausedAt.current = Date.now();
      setTimer({ ...timer, pausedLeft: Math.max(0, timer.endAt - Date.now()) });
    } else {
      if (pausedAt.current) pausedMs.current += Date.now() - pausedAt.current;
      pausedAt.current = null;
      setTimer({ ...timer, endAt: Date.now() + timer.pausedLeft, pausedLeft: null });
    }
  }

  function exit() {
    if (index === 0 || confirm("End the workout? Nothing will be saved.")) onClose();
  }

  const elapsed = Math.max(0, ((pausedAt.current ?? clock) - startedAt.current - pausedMs.current) / 1000);

  // Mirror the current step on the iPhone lock screen (Live Activity). No-op on the web.
  const activityStarted = useRef(false);
  const activityFinished = useRef(false);
  useEffect(() => {
    const progress = steps.length ? index / steps.length : 1;
    let state: ActivityState;
    if (finished) {
      state = { phase: "done", title: "Workout complete", detail: `${setsDone} sets · ${formatClock(elapsed)}`, progress: 1 };
    } else if (!step || step.kind === "warmup") {
      state = { phase: "work", title: "Warm-up", detail: workout.title, big: "", progress };
    } else if (step.kind === "work") {
      const p = workout.items[step.item];
      const detail = `Set ${step.set} of ${step.sets}${step.side ? ` · ${step.side === "left" ? "Left" : "Right"}` : ""}`;
      state = { phase: "work", title: p.exercise.name, detail, big: step.seconds === null ? step.reps : `${step.seconds}s`, progress };
      if (timer.phase !== "idle") {
        state = { ...state, phase: timer.phase === "countdown" ? "countdown" : "hold", endsAt: timer.endAt, big: undefined };
      }
    } else {
      const up = steps[index + 1];
      const upItem = up?.kind === "work" ? workout.items[up.item] : null;
      state = {
        phase: "rest",
        title: step.label,
        detail: upItem && up?.kind === "work" ? `Next: set ${up.set} of ${up.sets}` : "",
        endsAt: timer.phase !== "idle" ? timer.endAt : undefined,
        progress,
        next: upItem?.exercise.name,
      };
    }
    if (timer.phase !== "idle" && timer.pausedLeft !== null && !finished) {
      state = { ...state, phase: "paused", endsAt: undefined, pausedLeft: timer.pausedLeft / 1000 };
    }
    if (!activityStarted.current) {
      activityStarted.current = true;
      liveActivity.start(workout.title, state);
    } else if (finished) {
      activityFinished.current = true;
      liveActivity.end(state, true);
    } else {
      liveActivity.update(state);
    }
    // Only when the step, timer or finish state changes, not every clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, timer, finished]);
  useEffect(
    () => () => {
      if (!activityFinished.current) liveActivity.end();
    },
    [],
  );

  // Segment fill: finished segments full, the current one by how far through its steps you are.
  const seg = finished ? count : segOf[index];
  const segSteps = segOf.filter((s) => s === seg).length;
  const segDone = segOf.slice(0, index).filter((s) => s === seg).length;
  const segFill = finished ? 1 : segSteps ? segDone / segSteps : 0;

  // The big center control for this step.
  let main: { icon: ReactNode; label: string; onClick: () => void } | null = null;
  if (step?.kind === "warmup") main = { icon: <PlayIcon />, label: "Start", onClick: next };
  else if (step?.kind === "work" && step.seconds === null) main = { icon: <CheckIcon />, label: "Done", onClick: completeWork };
  else if (step?.kind === "work" && timer.phase === "idle")
    main = {
      icon: <PlayIcon />,
      label: `Start ${step.seconds}s`,
      onClick: () => setTimer({ phase: "countdown", endAt: Date.now() + 3000, total: 3, pausedLeft: null }),
    };
  else if (timer.phase !== "idle") main = { icon: paused ? <PlayIcon /> : <PauseIcon />, label: paused ? "Resume" : "Pause", onClick: togglePause };

  return (
    <div className="player fixed inset-0 z-50 flex flex-col bg-bg pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-4">
        {/* Top: close, segmented progress, clock */}
        <div className="flex items-center gap-3">
          <button type="button" onClick={exit} aria-label="End workout" className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-muted">
            ×
          </button>
          <div className="flex flex-1 gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={count} aria-valuenow={seg}>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className={`h-1.5 overflow-hidden rounded-full bg-line ${i === 0 ? "flex-[0.6]" : "flex-1"}`}>
                <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${i < seg ? 100 : i === seg ? segFill * 100 : 0}%` }} />
              </div>
            ))}
          </div>
          <span className="w-12 text-right font-mono text-sm tabular-nums text-muted">{formatClock(elapsed)}</span>
        </div>

        {finished ? (
          <FinishView
            elapsed={elapsed}
            setsDone={setsDone}
            exercisesDone={done.size}
            exercises={workout.items.length}
            bests={newBests(history, weights).map((b) => ({ name: getExercise(b.id)?.name ?? b.id, weight: b.weight }))}
          />
        ) : step?.kind === "warmup" ? (
          <div key={index} className="animate-rise flex min-h-0 flex-1 flex-col overflow-y-auto pt-8">
            <h1 className="text-3xl font-bold leading-tight tracking-tight">{workout.title}</h1>
            <p className="mt-1 text-sm font-medium text-muted">
              {workout.estMinutes > 0 && `~${workout.estMinutes} min · `}
              {workout.items.length} moves
            </p>
            <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-accent">Warm-up first</p>
            <ul className="mt-3 space-y-3 text-lg">
              {step.lines.map((l) => (
                <li key={l} className="flex gap-3">
                  <span className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  {l}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted">Then</p>
            <ol className="mt-2 divide-y divide-line rounded-2xl border border-line bg-card">
              {workout.items.map((p, i) => (
                <li key={p.key + p.exercise.id} className="flex items-baseline gap-3 px-4 py-2.5">
                  <span className="w-4 shrink-0 text-sm font-bold tabular-nums text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{p.exercise.name}</span>
                  <span className="shrink-0 text-sm tabular-nums text-muted">
                    {p.sets} × {p.reps}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : step?.kind === "work" ? (
          <WorkView
            key={index}
            workout={workout}
            step={step}
            timer={timer}
            remaining={remaining}
            paused={paused}
            draft={draft}
            onDraft={setDraft}
            last={lastTime(history, workout.items[step.item].exercise.id)}
          />
        ) : step?.kind === "rest" ? (
          <RestView
            key={index}
            workout={workout}
            step={step}
            remaining={remaining}
            total={timer.phase === "idle" ? step.seconds : timer.total}
            paused={paused}
            nextStep={steps[index + 1]}
            history={history}
            onAdd={tap(() =>
              setTimer((t) =>
                t.phase === "idle"
                  ? t
                  : t.pausedLeft !== null
                    ? { ...t, pausedLeft: t.pausedLeft + 15000, total: t.total + 15 }
                    : { ...t, endAt: t.endAt + 15000, total: t.total + 15 },
              ),
            )}
          />
        ) : null}

        {/* Bottom controls */}
        <div className="mt-4">
          {finished ? (
            <div className="space-y-2">
              {done.size > 0 ? (
                <>
                  <button type="button" onClick={() => onFinish([...done], weights)} className="w-full rounded-full bg-accent py-4 text-lg font-semibold text-accent-ink active:scale-[0.99]">
                    {done.size >= workout.items.length ? "Save workout" : "Save what I did"}
                  </button>
                  <button type="button" onClick={onClose} className="w-full py-2 text-sm text-muted">
                    Close without saving
                  </button>
                </>
              ) : (
                // Nothing done: nothing to save (an empty save would log the whole workout).
                <button type="button" onClick={onClose} className="w-full rounded-full border border-line bg-card py-4 text-lg font-semibold active:scale-[0.99]">
                  Close
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-start justify-between px-2">
              <RoundButton label="Back" onClick={tap(() => setIndex((i) => Math.max(0, i - 1)))} disabled={index === 0}>
                <BackIcon />
              </RoundButton>
              {main ? (
                <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={tap(main.onClick)}
                    aria-label={main.label}
                    className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg transition active:scale-95"
                  >
                    {main.icon}
                  </button>
                  <span className="text-xs font-semibold text-muted">{main.label}</span>
                </div>
              ) : (
                <span />
              )}
              <RoundButton label={step?.kind === "rest" ? "Skip rest" : "Skip"} onClick={tap(next)}>
                <SkipIcon />
              </RoundButton>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** "3-5" → 3-5 reps; "20 contacts" → 20 + contacts; "50-60 m" → 50-60 + m; "8/side" → 8 + reps/side. */
function splitReps(reps: string): { big: string; unit: string } {
  const m = reps.match(/^(\d+(?:[–-]\d+)?)\s*(.*)$/);
  if (!m) return { big: reps, unit: "" };
  const rest = m[2].trim();
  if (!rest) return { big: m[1], unit: "reps" };
  if (rest.startsWith("/")) return { big: m[1], unit: `reps${rest}` };
  return { big: m[1], unit: rest };
}

function WorkView({
  workout,
  step,
  timer,
  remaining,
  paused,
  draft,
  onDraft,
  last,
}: {
  workout: Workout;
  step: Extract<LiveStep, { kind: "work" }>;
  timer: Timer;
  remaining: number;
  paused: boolean;
  draft: number | null;
  onDraft: (w: number | null) => void;
  last: ReturnType<typeof lastTime>;
}) {
  const p = workout.items[step.item];
  const loaded = step.seconds === null && isLoaded(p.exercise);
  const timing = step.seconds !== null && timer.phase !== "idle";
  const holdish = /hold|iso/i.test(`${p.reps} ${p.exercise.name}`);
  return (
    <div className="animate-rise flex min-h-0 flex-1 flex-col pt-3">
      {/* The move fills what's left (up to ~half the screen), so the info and controls never collide on short phones. */}
      <div className="relative min-h-[22dvh] flex-1 overflow-hidden rounded-3xl bg-card lg:max-h-none" style={{ maxHeight: "45dvh" }}>
        <div className="absolute inset-0">
          <ExerciseDemo exercise={p.exercise} size="lg" />
        </div>
        {timing && (
          <div className="absolute inset-0 flex items-center justify-center bg-bg/70 backdrop-blur-sm">
            {timer.phase === "countdown" ? (
              <span key={remaining} className="animate-rise text-9xl font-bold tabular-nums text-accent">
                {remaining}
              </span>
            ) : (
              <Ring value={remaining} total={timer.phase === "running" ? timer.total : 1} label={paused ? "Paused" : holdish ? "Hold" : "Go"} />
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex shrink-0 flex-col">
        <p className="text-sm font-semibold uppercase tracking-wider text-muted">
          Move {step.item + 1} of {workout.items.length} · Set {step.set} of {step.sets}
          {step.side && <span className="text-accent"> · {step.side === "left" ? "Left" : "Right"}</span>}
        </p>
        <h1 className="mt-0.5 text-2xl font-bold leading-tight">{p.exercise.name}</h1>
        {(() => {
          // Big number, small unit: "3-5" reps, "20 contacts", "50-60 m", "8/side".
          const { big, unit } = step.seconds !== null ? { big: `${step.seconds}s`, unit: "" } : splitReps(step.reps);
          return (
            <p className={`mt-2 flex flex-wrap items-baseline gap-x-2 font-bold leading-none tracking-tight tabular-nums ${loaded ? "text-6xl" : "text-7xl"}`}>
              <span className={big.length > 7 ? "text-5xl" : ""}>{big}</span>
              {unit && <span className="text-xl font-semibold tracking-normal text-muted">{unit}</span>}
            </p>
          );
        })()}
        {p.note && <p className="mt-2 text-sm font-medium text-accent">{p.note}</p>}
        {loaded ? (
          <div className="mt-3">
            <WeightStepper value={draft} onChange={onDraft} />
            {last && <p className="mt-1.5 text-center text-xs text-muted">Last time: {formatWeights(last.weights)}</p>}
          </div>
        ) : (
          <p className="mt-2 line-clamp-2 text-sm text-muted">{p.cue}</p>
        )}
      </div>
    </div>
  );
}

function RestView({
  workout,
  step,
  remaining,
  total,
  paused,
  nextStep,
  history,
  onAdd,
}: {
  workout: Workout;
  step: Extract<LiveStep, { kind: "rest" }>;
  remaining: number;
  total: number;
  paused: boolean;
  nextStep: LiveStep | undefined;
  history: LiftLog[];
  onAdd: () => void;
}) {
  const up = nextStep?.kind === "work" ? nextStep : null;
  const upItem = up ? workout.items[up.item] : null;
  const upLast = upItem && isLoaded(upItem.exercise) ? lastTime(history, upItem.exercise.id) : null;
  return (
    <div className="animate-rise flex min-h-0 flex-1 flex-col items-center justify-center gap-5">
      <Ring value={remaining} total={total} label={paused ? "Paused" : step.label} big />
      <button type="button" onClick={onAdd} className="rounded-full border border-line bg-card px-5 py-2 text-sm font-semibold">
        +15 s
      </button>
      {up && upItem && (
        <div className="flex w-full items-center gap-3 rounded-3xl border border-line bg-card p-3">
          <div className="h-20 w-24 shrink-0 overflow-hidden rounded-2xl">
            <ExerciseDemo exercise={upItem.exercise} size="lg" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">Up next</p>
            <p className="truncate text-lg font-semibold">{upItem.exercise.name}</p>
            <p className="text-sm text-muted">
              Set {up.set} of {up.sets} · {up.seconds !== null ? `${up.seconds}s` : up.reps}
              {up.side ? ` · ${up.side}` : ""}
            </p>
            {upLast && <p className="text-xs font-medium text-accent">Last: {formatWeights(upLast.weights)}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function FinishView({
  elapsed,
  setsDone,
  exercisesDone,
  exercises,
  bests,
}: {
  elapsed: number;
  setsDone: number;
  exercisesDone: number;
  exercises: number;
  bests: { name: string; weight: number }[];
}) {
  return (
    <div className="animate-rise flex flex-1 flex-col items-center justify-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-accent text-accent-ink">
        <CheckIcon />
      </div>
      <h1 className="mt-5 text-3xl font-bold">{exercisesDone >= exercises ? "Workout done" : "Partly done"}</h1>
      {exercisesDone < exercises && (
        <p className="mt-1 text-sm text-muted">
          {exercisesDone === 0 ? "No moves done, so there's nothing to save." : `${exercisesDone} of ${exercises} moves. Only what you did gets saved.`}
        </p>
      )}
      <div className="mt-8 grid w-full grid-cols-3 gap-2">
        <Stat value={formatClock(elapsed)} label="time" />
        <Stat value={String(setsDone)} label="sets" />
        <Stat value={`${exercisesDone}/${exercises}`} label="moves" />
      </div>
      {bests.length > 0 && (
        <div className="mt-4 w-full space-y-2">
          {bests.map((b) => (
            <div key={b.name} className="flex items-center justify-between rounded-2xl bg-accent-soft px-4 py-3 text-left">
              <span className="text-sm font-semibold">🏆 New best: {b.name}</span>
              <span className="font-bold tabular-nums text-accent">{b.weight} lb</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WeightStepper({ value, onChange }: { value: number | null; onChange: (w: number | null) => void }) {
  const step = (d: number) => onChange(Math.max(0, (value ?? 0) + d));
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => step(-5)} aria-label="5 pounds less" className="h-12 w-14 rounded-2xl border border-line bg-card text-xl font-bold active:scale-95">
        −
      </button>
      <label className="flex h-12 flex-1 items-center justify-center gap-1 rounded-2xl border border-line bg-card">
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={2.5}
          placeholder="Add weight"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Math.max(0, Number(e.target.value)))}
          className={`bg-transparent text-center text-2xl font-bold tabular-nums outline-none placeholder:text-base placeholder:font-medium placeholder:text-muted ${value === null ? "w-28" : "w-20"}`}
          aria-label="Weight in pounds"
        />
        {value !== null && <span className="text-sm font-semibold text-muted">lb</span>}
      </label>
      <button type="button" onClick={() => step(5)} aria-label="5 pounds more" className="h-12 w-14 rounded-2xl border border-line bg-card text-xl font-bold active:scale-95">
        +
      </button>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-2 py-4">
      <p className="text-2xl font-bold tabular-nums">{value}</p>
      <p className="text-xs uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}

function Ring({ value, total, label, big }: { value: number; total: number; label: string; big?: boolean }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  return (
    <div className={`relative ${big ? "h-64 w-64" : "h-48 w-48"}`}>
      <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
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

function RoundButton({ children, label, onClick, disabled }: { children: ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5 pt-3">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className="flex h-14 w-14 items-center justify-center rounded-full border border-line bg-card text-ink transition active:scale-95 disabled:opacity-30"
      >
        {children}
      </button>
      <span className="text-xs font-semibold text-muted">{label}</span>
    </div>
  );
}

const PlayIcon = () => (
  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden>
    <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
  </svg>
);
const PauseIcon = () => (
  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor" aria-hidden>
    <rect x="6" y="5" width="4.5" height="14" rx="1.2" />
    <rect x="13.5" y="5" width="4.5" height="14" rx="1.2" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const SkipIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
    <path d="M5 6.2v11.6a.8.8 0 0 0 1.25.66L14.5 12.7a.8.8 0 0 0 0-1.4L6.25 5.54A.8.8 0 0 0 5 6.2Z" />
    <rect x="16" y="5.5" width="3" height="13" rx="1" />
  </svg>
);
const BackIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
    <path d="M19 6.2v11.6a.8.8 0 0 1-1.25.66L9.5 12.7a.8.8 0 0 1 0-1.4l8.25-5.76A.8.8 0 0 1 19 6.2Z" />
    <rect x="5" y="5.5" width="3" height="13" rx="1" />
  </svg>
);
