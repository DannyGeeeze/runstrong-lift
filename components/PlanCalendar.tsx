"use client";

// The plan: the next weeks (or the season) as a Monday-Sunday calendar. Each day shows its run,
// any race, the planned lift and a note marker; each week shows its phase and planned sessions.
// Tap a day to change its run (the plan re-plans), read the planned workout, and write a note.

import { useEffect, useState } from "react";
import { addDays, formatDay, mondayOf } from "@/lib/dates";
import { RUN_TYPE_LABEL } from "@/lib/day";
import { PLAN_SOURCE_LABEL, type PlanDay } from "@/lib/plan";
import { BREAK_STAGE_LABEL, EASY_SESSIONS, PHASE_LABEL } from "@/lib/rules";
import { storage } from "@/lib/storage";
import type { LiftLog, Race, RunType } from "@/lib/types";
import { RunTypePicker } from "./RunTypePicker";
import { WorkoutCard } from "./WorkoutCard";

const TYPE_DOT: Record<RunType, string> = {
  easy: "bg-[var(--viz-easy)]",
  long: "bg-[var(--viz-easy)]",
  workout: "bg-[var(--viz-hard)]",
  race: "bg-[var(--viz-hard)]",
  rest: "bg-line",
};
const TYPE_SHORT: Record<RunType, string> = { easy: "Easy", long: "Long", workout: "Wkt", race: "Race", rest: "Rest" };

/** Short name for a planned lift, for a small calendar cell. */
function liftShort(d: PlanDay): string {
  const w = d.workout;
  if (w.decision.session === "none") return d.type === "race" ? "" : "No lift";
  return w.title.replace("Full strength, half volume", "Full · half").replace("Short strength (20 min)", "Short").replace("Ramp-week strength", "Ramp").replace("Week-off isos", "Holds");
}

export function PlanCalendar({
  plan,
  today,
  races,
  notes,
  overrides,
  history,
}: {
  plan: PlanDay[];
  today: string;
  races: Race[];
  notes: Record<string, string>;
  overrides: Record<string, RunType>;
  history: LiftLog[];
}) {
  const [selected, setSelected] = useState<string>(today);
  const byDate = new Map(plan.map((d) => [d.date, d]));
  const first = mondayOf(today);
  const last = plan.length ? plan[plan.length - 1].date : today;
  const weeks: string[] = [];
  for (let m = first; m <= last; m = addDays(m, 7)) weeks.push(m);
  const sel = byDate.get(selected) ?? plan[0];

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6">
      <div className="min-w-0 rounded-2xl border border-line bg-card p-2 sm:p-3">
        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1 px-0.5 pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>
              <span className="sm:hidden">{d[0]}</span>
              <span className="hidden sm:inline">{d}</span>
            </span>
          ))}
        </div>
        {weeks.map((monday) => {
          const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
          const inPlan = days.map((d) => byDate.get(d)).filter((d): d is PlanDay => !!d);
          const strength = inPlan.filter((d) => d.workout.decision.strength && d.workout.decision.session !== "none").length;
          const plyo = inPlan.filter((d) => d.workout.decision.plyos && d.workout.decision.session !== "none").length;
          const ref = inPlan[inPlan.length - 1];
          const raceThisWeek = races.filter((r) => r.date >= monday && r.date <= addDays(monday, 6));
          return (
            <section key={monday} className="mt-2 first:mt-0">
              <p className="flex flex-wrap items-baseline gap-x-2 px-1 pb-1 text-[11px] text-muted">
                <span className="font-semibold text-ink">{monday === first ? "This week" : `Week of ${formatDay(monday).split(", ")[1]}`}</span>
                {ref && (
                  <span>
                    {ref.stage !== "normal" ? BREAK_STAGE_LABEL[ref.stage] : PHASE_LABEL[ref.phase]}
                    {ref.phaseSuggested && ref.stage === "normal" ? " (suggested)" : ""}
                  </span>
                )}
                <span>
                  · {strength} strength · {plyo} plyo
                </span>
                {raceThisWeek.length > 0 && <span className="font-semibold text-accent">· {raceThisWeek.map((r) => r.name).join(", ")}</span>}
              </p>
              <div className="grid grid-cols-7 gap-1">
                {days.map((date) => {
                  const d = byDate.get(date);
                  const past = date < today;
                  const isSel = date === sel?.date;
                  const race = races.find((r) => r.date === date);
                  const lift = d && d.workout.decision.session !== "none";
                  const light = d && EASY_SESSIONS.includes(d.workout.decision.session);
                  if (!d) {
                    return (
                      <div key={date} className="min-h-14 rounded-lg p-1 text-[11px] tabular-nums text-muted/50 sm:min-h-20">
                        {Number(date.slice(8))}
                        {past && notes[date] && <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-muted/50 align-middle" />}
                      </div>
                    );
                  }
                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setSelected(date)}
                      aria-pressed={isSel}
                      aria-label={`${formatDay(date)}: ${RUN_TYPE_LABEL[d.type]}${race ? `, ${race.name}` : ""}, ${lift ? d.workout.title : "no lift"}${notes[date] ? ", has a note" : ""}`}
                      className={`flex min-h-14 flex-col items-start gap-0.5 rounded-lg border p-1 text-left transition-colors sm:min-h-20 sm:p-1.5 ${
                        isSel ? "border-accent bg-accent-soft/40" : date === today ? "border-accent/50 bg-card-2" : "border-transparent bg-card-2 hover:border-line"
                      }`}
                    >
                      <span className="flex w-full items-center justify-between">
                        <span className={`text-[11px] font-bold tabular-nums ${date === today ? "text-accent" : ""}`}>{Number(date.slice(8))}</span>
                        {notes[date] && <span className="h-1.5 w-1.5 rounded-full bg-ink/70" aria-hidden />}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] font-medium text-muted">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${TYPE_DOT[d.type]}`} aria-hidden />
                        <span className="hidden sm:inline">{TYPE_SHORT[d.type]}</span>
                      </span>
                      {race ? (
                        <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-accent">{race.name}</span>
                      ) : lift ? (
                        <>
                          <span className="hidden sm:block">
                            <span className="line-clamp-2 text-[10px] font-semibold leading-tight">{liftShort(d)}</span>
                          </span>
                          <span
                            className={`mt-auto h-1.5 w-1.5 rounded-full sm:hidden ${light ? "border border-ink/70" : "bg-ink/80"}`}
                            aria-hidden
                          />
                        </>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-muted">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--viz-easy)]" /> Easy / long</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[var(--viz-hard)]" /> Workout / race</span>
          <span className="inline-flex items-center gap-1 sm:hidden"><span className="h-1.5 w-1.5 rounded-full bg-ink/80" /> Lift</span>
          <span className="inline-flex items-center gap-1 sm:hidden"><span className="h-1.5 w-1.5 rounded-full border border-ink/70" /> Light session</span>
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ink/70" /> Has a note</span>
        </p>
      </div>

      {sel && (
        <DayPanel
          key={sel.date}
          day={sel}
          today={today}
          race={races.find((r) => r.date === sel.date)}
          note={notes[sel.date] ?? ""}
          overridden={!!overrides[sel.date]}
          history={history}
        />
      )}
    </div>
  );
}

function DayPanel({
  day,
  today,
  race,
  note,
  overridden,
  history,
}: {
  day: PlanDay;
  today: string;
  race?: Race;
  note: string;
  overridden: boolean;
  history: LiftLog[];
}) {
  const [text, setText] = useState(note);
  const [showMoves, setShowMoves] = useState(false);
  useEffect(() => setText(note), [note]);
  const w = day.workout;
  const lift = w.decision.session !== "none";
  // Save the note shortly after typing stops, and when leaving the box.
  useEffect(() => {
    if (text === note) return;
    const t = setTimeout(() => storage.setNote(day.date, text), 600);
    return () => clearTimeout(t);
  }, [text, note, day.date]);

  return (
    <aside className="mt-4 space-y-3 rounded-2xl border border-line bg-card p-4 lg:sticky lg:top-0 lg:mt-0">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-accent">{day.date === today ? "Today" : formatDay(day.date)}</p>
        <p className="mt-0.5 text-xs text-muted">
          {day.stage !== "normal" ? BREAK_STAGE_LABEL[day.stage] : PHASE_LABEL[day.phase]}
          {day.phaseSuggested && day.stage === "normal" ? " (suggested)" : ""} · {PLAN_SOURCE_LABEL[day.source]}
          {day.label && day.label !== "workout" ? ` (${day.label})` : ""}
        </p>
        {race && <p className="mt-1 text-sm font-semibold">🏁 {race.name}</p>}
      </div>

      <div>
        <p className="text-xs font-medium text-muted">Run</p>
        <RunTypePicker value={day.type} className="mt-1" onPick={(t) => storage.setOverride(day.date, overridden && day.type === t ? null : t)} />
        {overridden && (
          <button type="button" className="mt-1 text-xs font-semibold text-accent" onClick={() => storage.setOverride(day.date, null)}>
            Undo my change
          </button>
        )}
      </div>

      <div className="rounded-xl bg-card-2 p-3">
        <p className="text-xs font-medium text-muted">Lift</p>
        <p className="mt-0.5 font-semibold">{lift ? w.title : day.type === "race" ? "Race day: no lift" : "No lift"}</p>
        {lift && (
          <p className="text-xs text-muted">
            ~{w.estMinutes} min · {w.items.length} moves{w.decision.optional ? " · optional" : ""}
          </p>
        )}
        <p className="mt-1 text-xs leading-relaxed text-muted">{w.decision.why}</p>
        {lift && (
          <button type="button" onClick={() => setShowMoves((v) => !v)} className="mt-2 text-xs font-semibold text-accent" aria-expanded={showMoves}>
            {showMoves ? "Hide moves" : "Show moves"}
          </button>
        )}
      </div>
      {lift && showMoves && <WorkoutCard workout={w} done={new Set()} onToggle={() => {}} history={history} />}

      <label className="block">
        <span className="text-xs font-medium text-muted">Note</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== note && storage.setNote(day.date, text)}
          rows={3}
          placeholder="Plans, how you felt, anything to remember…"
          className="mt-1 w-full resize-y rounded-xl border border-line bg-card-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </label>
    </aside>
  );
}
