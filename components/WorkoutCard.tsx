"use client";

import { useState } from "react";
import type { Workout } from "@/lib/rules";
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
                    <a
                      href={p.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-sm font-medium text-accent"
                    >
                      watch ↗
                    </a>
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
            </li>
          );
        })}
      </ol>

      {decision.session !== "none" && (
        <p className="text-xs text-muted">
          Low sets, low reps, more than 70% effort, never to failure.
        </p>
      )}
    </Card>
  );
}
