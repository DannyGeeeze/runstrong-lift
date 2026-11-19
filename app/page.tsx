"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RecoveryCard } from "@/components/RecoveryCard";
import { RunRow } from "@/components/RunList";
import { LiveWorkout } from "@/components/LiveWorkout";
import { WeekPlan } from "@/components/WeekPlan";
import { WorkoutCard } from "@/components/WorkoutCard";
import { PLAN_SOURCE_LABEL, planDays, type PlanDay } from "@/lib/plan";
import { Button, Card, Notice, SectionTitle, Toggle } from "@/components/ui";
import { addDays, diffDays, formatDay, todayLocal } from "@/lib/dates";
import { dayType, futureHardOverrides, RUN_TYPE_LABEL } from "@/lib/day";
import {
  addToBlock,
  decideCatchUp,
  EASY_SESSIONS,
  decideSession,
  generateWorkout,
  BREAK_STAGE_LABEL,
  PHASE_LABEL,
  suggestBreakStage,
  toLiftLog,
  UPPER_FOCUS_LABEL,
  weekCounts,
  weeklyMilesFor,
  UPPER_FOCUSES,
  type GenerateInput,
  type Workout,
} from "@/lib/rules";
import { isSampleRace } from "@/lib/mock";
import { newId, storage } from "@/lib/storage";
import { METERS_PER_MILE } from "@/lib/strava";
import { useHydrated, useStore } from "@/lib/useStore";
import { useRuns } from "@/lib/useRuns";
import type { EasyFocus, LiftLog, RunType, UpperFocus } from "@/lib/types";

const TYPES: RunType[] = ["easy", "long", "workout", "race", "rest"];

const EASY_OPTIONS: { value: EasyFocus; label: string }[] = [
  { value: "upper", label: "Upper body" },
  { value: "touch-up", label: "Touch-up" },
];

const LOGGED_LABEL: Record<string, string> = {
  full: "Full strength",
  short: "Short strength",
  "plyos-isos": "Plyos + Isos",
  taper: "Race-day isos",
  return: "Week-off isos",
  "touch-up": "Touch-up",
  upper: "Upper body",
  "long-isos": "Long-run isos",
  none: "Nothing",
};

export default function TodayPage() {
  const hydrated = useHydrated();
  const { profile } = useStore();
  const router = useRouter();
  // First visit: onboarding before anything else.
  useEffect(() => {
    if (hydrated && !profile) router.replace("/welcome");
  }, [hydrated, profile, router]);
  if (!hydrated || !profile) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Today />;
}

function Today() {
  const data = useStore();
  const { settings, races, history, overrides, block, profile, recovery } = data;
  const runsState = useRuns(settings.mockMode);
  const { runs, source, status, loading, error } = runsState;
  const today = todayLocal();
  const [shortOnTime, setShortOnTime] = useState(profile?.sessionMinutes === 20);
  const [mode, setMode] = useState<"today" | "catchup">("today");
  const [state, setState] = useState<{ sig: string; workout: Workout; done: Set<string> } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  // Desktop planning: which day of the week plan is open (today by default).
  const [planDate, setPlanDate] = useState(today);
  // Easy days default to upper body (touch-up the week before an A race); tapping overrides it.
  const [easyPick, setEasyPick] = useState<EasyFocus | undefined>(undefined);
  const easyFocus = easyPick;
  // Upper-body days rotate body parts (the one done longest ago); tapping overrides it.
  const [upperFocus, setUpperFocus] = useState<UpperFocus | undefined>(undefined);

  const day = dayType(today, runs, overrides, races);
  const yesterday = dayType(addDays(today, -1), runs, overrides, races);
  // Session size follows weekly mileage: the last 7 days of runs, or the setup answer.
  const last7 = runs.filter((r) => r.date > addDays(today, -7) && r.date <= today);
  const weeklyMiles = weeklyMilesFor(last7.reduce((sum, r) => sum + r.distanceM, 0) / METERS_PER_MILE, last7.length, profile?.weeklyMiles);
  const weeklyMilesKey = weeklyMiles ? `${weeklyMiles.source}:${weeklyMiles.miles.toFixed(1)}` : "";

  const ctx: GenerateInput = useMemo(
    () => ({
      today,
      dayType: day.type,
      phase: settings.phase,
      races,
      settings,
      history,
      block,
      profile,
      shortOnTime,
      easyFocus,
      upperFocus,
      weeklyMiles,
      extraHardDays: futureHardOverrides(today, overrides),
    }),
    [today, day.type, settings, races, history, block, profile, shortOnTime, easyFocus, upperFocus, overrides, weeklyMilesKey],
  );

  const preview = decideSession(ctx);
  // Week off replaces the easy-day choice with its own optional holds.
  const easyDay = preview.role === "easy" && settings.breakStage !== "off";
  const breakNext = suggestBreakStage(settings, today);
  const raceDay = preview.role === "thu-race" || preview.role === "other-race";
  const todayIsLift = !EASY_SESSIONS.includes(preview.session) && preview.session !== "none";
  const catchUp = !todayIsLift ? decideCatchUp(ctx, loading ? undefined : yesterday.type) : null;
  const sig = JSON.stringify([today, day.type, settings, races, profile, shortOnTime, easyFocus, upperFocus, mode, weeklyMilesKey]);
  const current = state?.sig === sig ? state : null;
  const loggedToday = history.filter((h) => h.date === today);

  const nextRace = races.find((r) => r.date >= today);
  const week = weekCounts(history, today);
  const plan = useMemo(() => planDays(ctx, overrides), [ctx, overrides]);
  const planned = planDate !== today ? plan.find((d) => d.date === planDate) : undefined;

  // The hero card: what today's lift is, before you generate it.
  const active = mode === "catchup" && catchUp && "session" in catchUp ? catchUp : preview;
  const canLift = preview.session !== "none" || mode === "catchup";
  const hero = generateWorkout({ ...ctx, decision: mode === "catchup" && catchUp && "session" in catchUp ? catchUp : undefined });
  const heroTitle = canLift ? hero.title : raceDay ? "Race day" : "Rest day";
  const hasOptions = (easyDay && mode === "today") || active.strength || (catchUp && "session" in catchUp);

  function generate(attempt = 0) {
    const decision = mode === "catchup" && catchUp && "session" in catchUp ? catchUp : undefined;
    const workout = generateWorkout({ ...ctx, attempt, decision });
    setState({ sig, workout, done: new Set() });
    setSaved(null);
  }

  function toggleDone(id: string) {
    if (!current) return;
    const done = new Set(current.done);
    if (done.has(id)) done.delete(id);
    else done.add(id);
    setState({ ...current, done });
  }

  function complete(ids?: string[], weights?: LiftLog["weights"]) {
    if (!current) return;
    const w = current.workout;
    const picked = ids ?? [...current.done];
    const doneIds = picked.length > 0 ? picked : undefined;
    storage.addLift(toLiftLog(w, newId(), doneIds, weights));
    storage.saveBlock(addToBlock(block, today, w.items.map((i) => ({ key: i.key, exerciseId: i.exercise.id }))));
    setSaved(w.title);
    setState(null);
  }

  const runCard = (
    <>
      <SectionTitle right={<span className="text-xs text-muted">Tap the kind of run</span>}>Today&apos;s run</SectionTitle>
      <Card>
        {loading ? (
          <p className="text-sm text-muted">Loading runs…</p>
        ) : day.runs.length ? (
          <div className="divide-y divide-line">
            {day.runs.map((r) => (
              <RunRow key={r.id} run={r} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No run yet today</p>
        )}
        <RunTypePicker value={day.type} onPick={(t) => storage.setOverride(today, overrides[today] === t ? null : t)} />
      </Card>
    </>
  );

  return (
    <div>
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{formatDay(today)}</p>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{profile?.name ? `Hey, ${profile.name}` : "RunStrong Lift"}</h1>
        </div>
        {nextRace && (
          <Link href="/races" className="rounded-xl bg-card px-3 py-2 text-right text-xs shadow-sm ring-1 ring-line lg:hidden">
            <span className="block font-semibold">
              {nextRace.name}
              {isSampleRace(nextRace) && <span className="ml-1.5 font-medium text-warn">Sample</span>}
            </span>
            <span className="text-muted">
              {diffDays(today, nextRace.date) === 0 ? "today" : `in ${diffDays(today, nextRace.date)} days`} · {nextRace.priority}
            </span>
          </Link>
        )}
      </header>

      {data.testMode && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
          <span className="font-semibold">Test: mid track season</span>
          <button type="button" className="font-semibold underline" onClick={() => storage.exitTestMode()}>
            Exit
          </button>
        </div>
      )}
      {source === "mock" && !data.testMode && (
        <div className="mt-4">
          <Notice>
            Demo runs{" "}
            {status?.configured && (
              <Link className="font-semibold text-accent" href="/settings">· Turn off</Link>
            )}
          </Notice>
        </div>
      )}
      {status?.configured && !status.connected && !settings.mockMode && (
        <Card className="mt-4 space-y-3">
          <p className="text-sm text-muted">Connect Strava so the app sees what kind of run you did. Or try it with sample runs.</p>
          <div className="flex gap-2">
            <a href="/api/strava/login" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">
              Connect Strava
            </a>
            <Button onClick={() => storage.saveSettings({ ...settings, mockMode: true })}>Try demo data</Button>
          </div>
        </Card>
      )}
      {error && (
        <div className="mt-4">
          <Notice tone="warn">{error}</Notice>
        </div>
      )}

      {!loading && (
        <div className="hidden lg:block">
          <WeekPlan plan={plan} selected={planned ? planDate : today} onSelect={setPlanDate} />
        </div>
      )}

      <div className="lg:mt-2 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
      <div className="min-w-0">
      {breakNext && !current && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
          <span>{breakNext.message}</span>
          <button
            type="button"
            className="shrink-0 font-semibold text-accent"
            onClick={() =>
              storage.saveSettings({ ...settings, breakStage: breakNext.next, breakStageSince: breakNext.next === "normal" ? "" : today })
            }
          >
            Switch
          </button>
        </div>
      )}

      {!current && <div className="lg:hidden">{runCard}</div>}

      <div className={planned ? "lg:hidden" : ""}>
      {!current && (
        <section className="mt-5 rounded-3xl border border-line bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">
              {mode === "catchup" ? "Make-up lift" : "Today's lift"}
            </p>
            <Link href="/settings" className="text-xs font-medium text-muted">
              {settings.breakStage !== "normal" ? BREAK_STAGE_LABEL[settings.breakStage] : PHASE_LABEL[settings.phase]}
            </Link>
          </div>

          {loading ? (
            <div className="mt-3 space-y-2" aria-hidden>
              <div className="h-8 w-2/3 animate-pulse rounded-lg bg-card-2" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-card-2" />
            </div>
          ) : (
            <h2 className="mt-2 text-3xl font-bold leading-tight tracking-tight">{heroTitle}</h2>
          )}
          {!loading && canLift && hero.estMinutes > 0 && (
            <p className="mt-1 text-sm font-medium text-muted">
              ~{hero.estMinutes} min · {hero.items.length} moves{active.optional ? " · optional" : ""}
            </p>
          )}
          {!loading && <p className="mt-3 text-sm leading-relaxed text-muted">{active.why}</p>}
          {preview.session === "touch-up" && mode === "today" && profile?.goals.includes("healthy") && (
            <div className="mt-3">
              <Notice tone="good">Recommended for staying healthy</Notice>
            </div>
          )}
          {(loggedToday.length > 0 || saved) && (
            <div className="mt-3">
              <Notice tone="good">
                {saved
                  ? `Saved “${saved}” to your history.`
                  : `Logged today: ${loggedToday
                      .map((l) => (l.upperFocus ? UPPER_FOCUS_LABEL[l.upperFocus] : LOGGED_LABEL[l.session]) + (l.volume === "half" ? " (half)" : ""))
                      .join(", ")}.`}
              </Notice>
            </div>
          )}

          {canLift || loading ? (
            <Button
              variant="primary"
              className={`mt-5 w-full py-5 text-lg ${loading ? "animate-pulse" : ""}`}
              onClick={() => generate(0)}
              disabled={loading}
            >
              {loading ? "Checking today's run…" : "Generate workout"}
            </Button>
          ) : (
            <p className="mt-4 text-base font-semibold">{raceDay ? "No lifting on race day." : "Nothing to lift today."}</p>
          )}

          {!loading && hasOptions && (
            <div className="mt-5 space-y-2 border-t border-line pt-4">
              {easyDay && mode === "today" && (
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-card-2 p-1">
                  {EASY_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      aria-pressed={preview.session === o.value}
                      onClick={() => setEasyPick(o.value)}
                      className={`min-h-10 rounded-lg px-1 text-sm font-semibold transition-colors ${
                        preview.session === o.value ? "bg-card text-ink shadow-sm ring-1 ring-line" : "text-muted"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
              {preview.session === "upper" && mode === "today" && (
                <div className="grid grid-cols-3 gap-1 rounded-xl bg-card-2 p-1">
                  {UPPER_FOCUSES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={preview.upperFocus === f}
                      onClick={() => setUpperFocus(f)}
                      className={`min-h-10 rounded-lg px-1 text-sm font-semibold leading-tight transition-colors ${
                        preview.upperFocus === f ? "bg-card text-ink shadow-sm ring-1 ring-line" : "text-muted"
                      }`}
                    >
                      {UPPER_FOCUS_LABEL[f]}
                    </button>
                  ))}
                </div>
              )}
              {active.strength && <Toggle checked={shortOnTime} onChange={setShortOnTime} label="Short on time (20 min)" />}
              {catchUp && "session" in catchUp && (
                <Toggle
                  checked={mode === "catchup"}
                  onChange={(v) => setMode(v ? "catchup" : "today")}
                  label="Lift this morning for yesterday"
                />
              )}
            </div>
          )}
          {!loading && catchUp && "blocked" in catchUp && <p className="mt-4 text-xs text-muted">{catchUp.blocked}</p>}
        </section>
      )}

      <div className="mt-4 space-y-3">
        {current && (
          <>
            <div className="flex items-center justify-between">
              <button type="button" className="min-h-10 text-sm font-medium text-accent" onClick={() => setState(null)}>
                ← Change
              </button>
              <button
                type="button"
                className="min-h-10 text-sm font-medium text-muted"
                onClick={() => generate(current.workout.attempt + 1)}
              >
                ↻ Different moves
              </button>
            </div>
            <WorkoutCard
              workout={current.workout}
              done={current.done}
              onToggle={toggleDone}
              history={history}
              actions={
                // The guided player is for doing the workout, on a phone. Desktop is for planning.
                current.workout.items.length > 0 && (
                  <Button variant="primary" className="w-full py-4 text-lg lg:hidden" onClick={() => setLive(true)}>
                    ▶ Start workout
                  </Button>
                )
              }
            />
            {current.workout.items.length > 0 && (
              <Button className="w-full" onClick={() => complete()}>
                {current.done.size > 0 ? "Save what I did" : "Already did it? Mark complete"}
              </Button>
            )}
            {live && (
              <LiveWorkout
                workout={current.workout}
                onClose={() => setLive(false)}
                history={history}
                onFinish={(ids, weights) => {
                  setLive(false);
                  complete(ids, weights);
                }}
              />
            )}
          </>
        )}
      </div>

      </div>
      {planned && <PlannedDay day={planned} onBack={() => setPlanDate(today)} onSetType={(t) => storage.setOverride(planned.date, overrides[planned.date] === t ? null : t)} history={history} />}

      {current && <div className="lg:hidden">{runCard}</div>}
      </div>

      {/* Desktop: a side column with the run, recovery and the week so far. On phones it stacks below. */}
      <aside className="min-w-0 lg:sticky lg:top-0">
        <div className="hidden lg:block">{runCard}</div>

        {/* Recovery is suggested with the workout: once it's generated or saved, or on a no-lift day. */}
        {!loading && (current || saved || (mode === "today" && preview.session === "none")) && (
          <RecoveryCard
            key={day.type}
            today={today}
            todayType={day.type}
            yesterdayType={yesterday.type}
            races={races}
            recovery={recovery}
            settings={settings}
          />
        )}

        <Link
          href="/week"
          className="mt-4 hidden grid-cols-2 gap-2 rounded-2xl border border-line bg-card p-4 hover:ring-1 hover:ring-line lg:grid"
        >
          <span className="col-span-2 text-xs font-semibold uppercase tracking-wider text-muted">Last 7 days</span>
          <span>
            <span className={`block text-2xl font-bold tabular-nums ${week.strength >= 2 ? "text-accent" : ""}`}>{week.strength}/2</span>
            <span className="text-xs text-muted">Strength</span>
          </span>
          <span>
            <span className={`block text-2xl font-bold tabular-nums ${week.plyo >= 2 ? "text-accent" : ""}`}>{week.plyo}/2</span>
            <span className="text-xs text-muted">Plyo</span>
          </span>
        </Link>
      </aside>
      </div>
    </div>
  );
}

/** Desktop: a future day from the week plan. Change its run type and the plan updates. */
function PlannedDay({
  day,
  onBack,
  onSetType,
  history,
}: {
  day: PlanDay;
  onBack: () => void;
  onSetType: (t: RunType) => void;
  history: LiftLog[];
}) {
  const w = day.workout;
  return (
    <div className="mt-5 hidden space-y-4 lg:block">
      <div className="rounded-3xl border border-line bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Planned · {formatDay(day.date)}</p>
          <button type="button" className="text-xs font-medium text-muted hover:text-ink" onClick={onBack}>
            Back to today
          </button>
        </div>
        <p className="mt-3 text-sm font-medium">
          Run: {RUN_TYPE_LABEL[day.type]}
          <span className="font-normal text-muted">
            {" "}
            · {PLAN_SOURCE_LABEL[day.source]}
            {day.label && day.label !== "workout" ? ` (${day.label})` : ""}
          </span>
        </p>
        <RunTypePicker value={day.type} onPick={onSetType} />
        <p className="mt-2 text-xs text-muted">Changing the run here saves it for that day, and the rest of the week re-plans.</p>
      </div>
      {w.decision.session === "none" ? (
        <div className="rounded-3xl border border-line bg-card p-5">
          <h2 className="text-2xl font-bold tracking-tight">{day.type === "race" ? "Race day" : "No lift"}</h2>
          <p className="mt-2 text-sm text-muted">{w.decision.why}</p>
        </div>
      ) : (
        <WorkoutCard workout={w} done={new Set()} onToggle={() => {}} history={history} />
      )}
    </div>
  );
}

/** The five run types as one row of equal buttons (no wrapping). */
function RunTypePicker({ value, onPick }: { value: RunType; onPick: (t: RunType) => void }) {
  return (
    <div className="mt-3 grid grid-cols-5 gap-1 rounded-xl bg-card-2 p-1" role="group" aria-label="Kind of run">
      {TYPES.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={value === t}
          onClick={() => onPick(t)}
          className={`min-h-10 rounded-lg px-0.5 text-[13px] font-semibold transition-colors ${
            value === t ? "bg-accent text-accent-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {RUN_TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  );
}

