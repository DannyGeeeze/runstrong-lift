"use client";

import { Fragment, useState, type ReactNode } from "react";
import { isoKind, isPlyo } from "@/lib/exercises";
import { plyoFamily } from "@/lib/rules/plyo";
import type { Prescription, Workout } from "@/lib/rules";
import type { LiftLog } from "@/lib/types";
import { formatWeights, isLoaded, lastTime } from "@/lib/weights";
import { ExerciseDemo } from "./ExerciseDemo";
import { Notice } from "./ui";

type Group = "plyo" | "strength" | "hold";
const GROUP_LABEL: Record<Group, string> = { plyo: "Plyos", strength: "Strength", hold: "Holds" };
/** Holds get their own section only when there are no strength moves (otherwise they sit with them). */
function groupOf(p: Prescription, hasStrength: boolean): Group {
  if (isPlyo(p.exercise)) return "plyo";
  return isoKind(p.exercise) && !hasStrength ? "hold" : "strength";
}
/** Which day of the coach's plyo template these plyos are (from the kinds of move). */
function plyoDayOf(items: Prescription[]): 1 | 2 {
  const fams = items.flatMap((p) => (isPlyo(p.exercise) ? [plyoFamily(p.exercise)] : []));
  return fams.includes("single") || fams.includes("lateral") ? 2 : 1;
}

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
  const [openCue, setOpenCue] = useState<Set<string>>(new Set());
  const toggleCue = (key: string) =>
    setOpenCue((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const { decision, items } = workout;

  // A note on two or more moves (e.g. "Easy day: leave 2-3 reps in the tank") is shown once, up top.
  const noteCount = new Map<string, number>();
  for (const p of items) if (p.note) noteCount.set(p.note, (noteCount.get(p.note) ?? 0) + 1);
  const sharedNote = [...noteCount].find(([, n]) => n >= 2)?.[0];
  const doneCount = items.filter((p) => done.has(p.exercise.id)).length;
  // Section labels (Plyos / Strength / Holds) when a session mixes them.
  const hasStrength = items.some((p) => !isPlyo(p.exercise) && !isoKind(p.exercise));
  const showGroups = new Set(items.map((p) => groupOf(p, hasStrength))).size > 1;
  const plyoDay = items.some((p) => isPlyo(p.exercise)) ? plyoDayOf(items) : null;

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
        {/* Actions are the phone's Start button; desktop is for planning, so there's nothing here. */}
        {actions && <div className="mt-4 lg:hidden">{actions}</div>}
      </header>

      {workout.warmup.length > 0 && (
        <div className="border-t border-line px-4 py-3">
          <button
            type="button"
            className="flex min-h-8 w-full items-center justify-between text-left text-sm font-semibold lg:pointer-events-none"
            onClick={() => setShowWarmup((v) => !v)}
            aria-expanded={showWarmup}
          >
            Warm-up · {workout.warmup.length}
            <span className="text-xs font-medium text-muted lg:hidden">{showWarmup ? "Hide" : "Show"}</span>
          </button>
          {/* Always shown on desktop (planning); tap to show on a phone. */}
          <ul className={`mt-2 list-disc space-y-1 pl-5 text-sm text-muted lg:columns-2 lg:gap-x-8 ${showWarmup ? "" : "hidden lg:block"}`}>
            {workout.warmup.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <ol className="border-t border-line">
        {/* Desktop: column headings for scanning. */}
        <li aria-hidden className="hidden border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted lg:grid lg:grid-cols-[2rem_minmax(0,1fr)_9rem_7.5rem_4.5rem] lg:gap-3">
          <span />
          <span>Move</span>
          <span>Sets × reps</span>
          <span>Rest</span>
          <span />
        </li>
        {items.map((p, i) => {
          const id = p.exercise.id;
          const isDone = done.has(id);
          const pairedWithPrev = p.supersetWith && items[i - 1]?.exercise.id === p.supersetWith;
          const pairedWithNext = p.supersetWith && !pairedWithPrev;
          const last = isLoaded(p.exercise) ? lastTime(history, id) : null;
          const note = p.note && p.note !== sharedNote ? p.note : undefined;
          const group = groupOf(p, hasStrength);
          const newGroup = showGroups && (i === 0 || groupOf(items[i - 1], hasStrength) !== group);
          const demoButton = (
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
          );
          return (
            <Fragment key={p.key + id}>
              {newGroup && (
                <li className="border-b border-line bg-card-2/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {GROUP_LABEL[group]}
                  {group === "plyo" && plyoDay && <span className="normal-case tracking-normal"> · Day {plyoDay}: {plyoDay === 1 ? "up & down + skipping" : "single-leg + lateral"}</span>}
                </li>
              )}
              <li className={`border-b border-line px-4 py-3.5 transition-colors last:border-b-0 ${isDone ? "bg-good-soft" : ""}`}>
                <div className="flex items-start gap-3 lg:grid lg:grid-cols-[2rem_minmax(0,1fr)_9rem_7.5rem_4.5rem] lg:items-start">
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
                      <span className="lg:hidden">{demoButton}</span>
                    </div>
                    {/* Phone: sets and rest under the name. Desktop: their own columns. */}
                    <p className="mt-0.5 text-sm lg:hidden">
                      <span className="font-semibold tabular-nums">
                        {p.sets} × {p.reps}
                      </span>
                      <span className="text-muted"> · rest {p.rest}</span>
                    </p>
                    {last && <p className="mt-0.5 text-xs font-semibold text-accent">Last time: {formatWeights(last.weights)}</p>}
                    {/* Phones: cues stop at 2 lines; tap to read the rest. Desktop: always in full. */}
                    <p
                      className={`mt-1 text-sm leading-snug text-muted lg:line-clamp-none ${openCue.has(p.key) ? "" : "line-clamp-2"}`}
                      onClick={() => toggleCue(p.key)}
                    >
                      {p.cue}
                    </p>
                    {p.cue.length > 90 && !openCue.has(p.key) && (
                      <button type="button" className="text-xs font-semibold text-muted underline lg:hidden" onClick={() => toggleCue(p.key)}>
                        More
                      </button>
                    )}
                    {note && <p className="mt-1 text-xs font-medium text-ink">{note}</p>}
                  </div>
                  <p className="hidden pt-0.5 text-sm font-semibold tabular-nums lg:block">
                    {p.sets} × {p.reps}
                  </p>
                  <p className="hidden pt-0.5 text-sm text-muted lg:block">{p.rest}</p>
                  <span className="hidden justify-self-end lg:block">{demoButton}</span>
                </div>
                {demo === p.key && (
                  <div className="animate-rise mt-3 lg:ml-11 lg:max-w-md">
                    <ExerciseDemo exercise={p.exercise} />
                  </div>
                )}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </section>
  );
}
