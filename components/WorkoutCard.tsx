"use client";

import { useState, type ReactNode } from "react";
import type { Workout } from "@/lib/rules";
import type { LiftLog } from "@/lib/types";
import { formatWeights, isLoaded, lastTime } from "@/lib/weights";
import { ExerciseDemo } from "./ExerciseDemo";
import { Notice } from "./ui";

export function WorkoutCard({
  workout,
  done,
  onToggle,
  history = [],
  actions,
}: {
  workout: Workout;
  done: Set<string>;
  onToggle: (id: string) => void;
  history?: LiftLog[];
  /** Shown under the header, e.g. the Start button. */
  actions?: ReactNode;
}) {
  const [showWarmup, setShowWarmup] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);
  const { decision, items } = workout;

  // A note on two or more moves (e.g. "Easy day: leave 2-3 reps in the tank") is shown once, up top.
  const noteCount = new Map<string, number>();
  for (const p of items) if (p.note) noteCount.set(p.note, (noteCount.get(p.note) ?? 0) + 1);
  const sharedNote = [...noteCount].find(([, n]) => n >= 2)?.[0];
  const doneCount = items.filter((p) => done.has(p.exercise.id)).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card">
      <header className="p-4 pb-3">
        <h2 className="text-2xl font-bold leading-tight tracking-tight">{workout.title}</h2>
        {items.length > 0 && (
          <p className="mt-1 text-sm font-medium text-muted">
            {workout.estMinutes > 0 && `~${workout.estMinutes} min · `}
            {items.length} moves
            {doneCount > 0 && <span className="text-good"> · {doneCount} done</span>}
          </p>
        )}
        <p className="mt-2 text-sm leading-relaxed text-muted">{decision.why}</p>
        {sharedNote && <p className="mt-2 text-sm font-medium text-ink">{sharedNote}</p>}
        {workout.volume && <p className="mt-2 text-sm text-muted">{workout.volume.note}</p>}
        {decision.warnings.length > 0 && (
          <div className="mt-3 space-y-2">
            {decision.warnings.map((w) => (
              <Notice key={w} tone="warn">
                {w}
              </Notice>
            ))}
          </div>
        )}
        {actions && <div className="mt-4">{actions}</div>}
      </header>

      {workout.warmup.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <button
            type="button"
            className="flex min-h-8 w-full items-center justify-between text-left text-sm font-semibold"
            onClick={() => setShowWarmup((v) => !v)}
            aria-expanded={showWarmup}
          >
            Warm-up · {workout.warmup.length}
            <span className="text-xs font-medium text-muted">{showWarmup ? "Hide" : "Show"}</span>
          </button>
          {showWarmup && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
              {workout.warmup.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ol className="divide-y divide-line border-t border-line">
        {items.map((p, i) => {
          const id = p.exercise.id;
          const isDone = done.has(id);
          const pairedWithPrev = p.supersetWith && items[i - 1]?.exercise.id === p.supersetWith;
          const pairedWithNext = p.supersetWith && !pairedWithPrev;
          const last = isLoaded(p.exercise) ? lastTime(history, id) : null;
          const note = p.note && p.note !== sharedNote ? p.note : undefined;
          return (
            <li key={p.key + id} className={`px-4 py-3.5 transition-colors ${isDone ? "bg-good-soft" : ""}`}>
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  aria-label={isDone ? `Mark ${p.exercise.name} not done` : `Mark ${p.exercise.name} done`}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold tabular-nums ${
                    isDone ? "border-good bg-good text-white" : "border-line text-muted"
                  }`}
                >
                  {isDone ? "✓" : i + 1}
                </button>
                <div className="min-w-0 flex-1">
                  {(pairedWithPrev || pairedWithNext) && (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {pairedWithNext ? "Superset · do with next" : "Superset · with previous"}
                    </p>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className={`font-semibold leading-snug ${isDone ? "text-muted line-through" : ""}`}>{p.exercise.name}</h3>
                    <button
                      type="button"
                      onClick={() => setDemo(demo === p.key ? null : p.key)}
                      aria-expanded={demo === p.key}
                      aria-label={`${demo === p.key ? "Hide" : "Show"} demo for ${p.exercise.name}`}
                      className={`flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold transition ${
                        demo === p.key ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent"
                      }`}
                    >
                      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
                        {demo === p.key ? <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" /> : <path d="M2.5 1.5v7l6-3.5z" fill="currentColor" />}
                      </svg>
                      Demo
                    </button>
                  </div>
                  <p className="mt-0.5 text-sm">
                    <span className="font-semibold tabular-nums">
                      {p.sets} × {p.reps}
                    </span>
                    <span className="text-muted"> · rest {p.rest}</span>
                  </p>
                  {last && <p className="mt-0.5 text-xs font-semibold text-accent">Last time: {formatWeights(last.weights)}</p>}
                  <p className="mt-1 text-sm leading-snug text-muted">{p.cue}</p>
                  {note && <p className="mt-1 text-xs font-medium text-ink">{note}</p>}
                </div>
              </div>
              {demo === p.key && (
                <div className="animate-rise mt-3">
                  <ExerciseDemo exercise={p.exercise} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
