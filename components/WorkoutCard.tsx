"use client";

import { useState } from "react";
import type { Workout } from "@/lib/rules";
import { ExerciseDemo } from "./ExerciseDemo";
import { Card, Notice } from "./ui";

export function WorkoutCard({
  workout,
  done,
  onToggle,
}: {
  workout: Workout;
  done: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [showWarmup, setShowWarmup] = useState(false);
  const [demo, setDemo] = useState<string | null>(null);
  const { decision } = workout;

  return (
    <Card className="space-y-4">
      <header>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-semibold leading-tight">{workout.title}</h2>
          {workout.estMinutes > 0 && (
            <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
              ~{workout.estMinutes} min
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-muted">
          <span className="font-medium text-ink">Why today: </span>
          {decision.why}
        </p>
      </header>

      {decision.warnings.map((w) => (
        <Notice key={w} tone="warn">
          {w}
        </Notice>
      ))}

      {workout.warmup.length > 0 && (
        <div>
          <button
            type="button"
            className="flex w-full items-center justify-between text-left text-sm font-semibold"
            onClick={() => setShowWarmup((v) => !v)}
            aria-expanded={showWarmup}
          >
            Warm-up
            <span className="text-muted">{showWarmup ? "Hide" : "Show"}</span>
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

      <ol className="space-y-3">
        {workout.items.map((p, i) => {
          const id = p.exercise.id;
          const isDone = done.has(id);
          const pairedWithPrev = p.supersetWith && workout.items[i - 1]?.exercise.id === p.supersetWith;
          return (
            <li
              key={p.key + id}
              className={`rounded-xl border border-line p-3 transition ${isDone ? "bg-good-soft" : "bg-card-2"} ${pairedWithPrev ? "-mt-1 border-t-0 rounded-t-none" : ""}`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggle(id)}
                  aria-label={isDone ? `Mark ${p.exercise.name} not done` : `Mark ${p.exercise.name} done`}
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    isDone ? "border-good bg-good text-white" : "border-line text-muted"
                  }`}
                >
                  {isDone ? "✓" : p.slot}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{p.exercise.name}</h3>
                    <button
                      type="button"
                      onClick={() => setDemo(demo === p.key ? null : p.key)}
                      aria-expanded={demo === p.key}
                      className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                        demo === p.key ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent"
                      }`}
                    >
                      <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden>
                        {demo === p.key ? <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" /> : <path d="M2.5 1.5v7l6-3.5z" fill="currentColor" />}
                      </svg>
                      Demo
                    </button>
                  </div>
                  <p className="mt-0.5 font-mono text-sm">
                    {p.sets} × {p.reps}
                    <span className="text-muted"> · rest {p.rest}</span>
                  </p>
                  {p.supersetWith && !pairedWithPrev && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-accent">Superset with next</p>
                  )}
                  <p className="mt-1 text-sm text-muted">{p.cue}</p>
                  {p.note && <p className="mt-1 text-xs font-medium text-ink">{p.note}</p>}
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

    </Card>
  );
}
