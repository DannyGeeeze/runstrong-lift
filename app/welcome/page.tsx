"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { addDays, dayInWeek, todayLocal } from "@/lib/dates";
import {
  EQUIPMENT_OPTIONS,
  EVENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  GOAL_OPTIONS,
  SPOT_OPTIONS,
  type EquipmentAccess,
  type EventFocus,
  type Experience,
  type Goal,
  type Profile,
  type TroubleSpot,
} from "@/lib/profile";
import { generateWorkout, PHASE_HINT, PHASE_LABEL, suggestPhase } from "@/lib/rules";
import { newId, storage } from "@/lib/storage";
import { useHydrated, useStore } from "@/lib/useStore";
import type { Phase, Race, Weekday } from "@/lib/types";

export default function WelcomePage() {
  const hydrated = useHydrated();
  if (!hydrated) return null;
  return <Onboarding />;
}

const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: "mon", label: "Mon" },
  { value: "tue", label: "Tue" },
  { value: "wed", label: "Wed" },
  { value: "thu", label: "Thu" },
  { value: "fri", label: "Fri" },
  { value: "sat", label: "Sat" },
  { value: "sun", label: "Sun" },
];

const PHASE_OPTIONS: { value: Phase; icon: string }[] = [
  { value: "off", icon: "🌤️" },
  { value: "early", icon: "🌱" },
  { value: "deep", icon: "🔥" },
  { value: "championship", icon: "🏆" },
];

const RACE_DISTANCE: Record<EventFocus, string> = { xc: "5K", distance: "3200m", mid: "1600m", long: "10K" };

interface Answers {
  name: string;
  events: EventFocus[];
  weeklyMiles: number;
  experience: Experience | null;
  equipment: EquipmentAccess | null;
  goals: Goal[];
  troubleSpots: TroubleSpot[];
  noTrouble: boolean;
  raceDay: Weekday;
  tuneUpDay: "mon" | "tue";
  workoutDays: Weekday[];
  sessionMinutes: 20 | 30 | 45;
  phase: Phase;
  goalRaceName: string;
  goalRaceDate: string;
  returnWeek: boolean;
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Onboarding() {
  const router = useRouter();
  const data = useStore();
  const today = todayLocal();
  const existingA = data.races.find((r) => r.priority === "A" && r.date >= today);
  const suggestion = suggestPhase(data.races, today);
  const p = data.profile;

  const [a, setA] = useState<Answers>(() => ({
    name: p?.name ?? "",
    events: p?.events ?? [],
    weeklyMiles: p?.weeklyMiles ?? 40,
    experience: p?.experience ?? null,
    equipment: p?.equipment ?? null,
    goals: p?.goals ?? [],
    troubleSpots: p?.troubleSpots ?? [],
    noTrouble: !!p && p.troubleSpots.length === 0,
    raceDay: p?.raceDay ?? "thu",
    tuneUpDay: data.settings.tuneUpDay,
    workoutDays: data.settings.workoutDays,
    sessionMinutes: p?.sessionMinutes ?? 45,
    phase: p ? data.settings.phase : suggestion.phase,
    goalRaceName: existingA?.name ?? "",
    goalRaceDate: existingA?.date ?? "",
    returnWeek: data.settings.returnWeek,
  }));
  const set = <K extends keyof Answers>(k: K, v: Answers[K]) => setA((prev) => ({ ...prev, [k]: v }));

  const [step, setStep] = useState(0);
  const [building, setBuilding] = useState(false);

  const steps: { key: string; ready: boolean; auto?: boolean }[] = [
    { key: "hello", ready: true },
    { key: "events", ready: a.events.length > 0 },
    { key: "miles", ready: true },
    { key: "experience", ready: !!a.experience, auto: true },
    { key: "equipment", ready: !!a.equipment, auto: true },
    { key: "goals", ready: a.goals.length > 0 },
    { key: "spots", ready: a.troubleSpots.length > 0 || a.noTrouble },
    { key: "week", ready: a.workoutDays.length > 0 },
    { key: "season", ready: !a.goalRaceName.trim() === !a.goalRaceDate },
    { key: "plan", ready: true },
  ];
  const current = steps[step];
  const isLast = step === steps.length - 1;

  function next() {
    if (step === steps.length - 2) {
      setBuilding(true);
      setTimeout(() => {
        setBuilding(false);
        setStep(step + 1);
      }, 900);
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  // Single-choice questions move on by themselves after a tap.
  function choose<K extends keyof Answers>(k: K, v: Answers[K]) {
    set(k, v);
    setTimeout(() => setStep((s) => s + 1), 250);
  }

  useEffect(() => {
    document.getElementById("scroller")?.scrollTo({ top: 0 });
  }, [step]);

  const profile: Profile | null =
    a.events.length && a.experience && a.equipment
      ? {
          name: a.name.trim(),
          events: a.events,
          weeklyMiles: a.weeklyMiles,
          experience: a.experience,
          equipment: a.equipment,
          goals: a.goals,
          troubleSpots: a.noTrouble ? [] : a.troubleSpots,
          sessionMinutes: a.sessionMinutes,
          raceDay: a.raceDay,
          completedAt: today,
        }
      : null;

  const settings = {
    ...data.settings,
    phase: a.phase,
    tuneUpDay: a.tuneUpDay,
    workoutDays: a.workoutDays,
    returnWeek: a.returnWeek,
  };

  const goalRace: Race | null =
    a.goalRaceName.trim() && a.goalRaceDate
      ? {
          id: existingA?.id ?? newId(),
          date: a.goalRaceDate,
          name: a.goalRaceName.trim(),
          distance: existingA?.distance ?? RACE_DISTANCE[a.events[0] ?? "xc"],
          priority: "A",
        }
      : null;

  const sample = useMemo(() => {
    if (step !== steps.length - 1 || !profile) return null;
    const races = goalRace ? [...data.races.filter((r) => r.id !== goalRace.id), goalRace] : data.races;
    let day = dayInWeek(today, a.raceDay === "thu" ? a.tuneUpDay : a.workoutDays[0] ?? "tue");
    if (day < today) day = addDays(day, 7);
    return generateWorkout({
      today: day,
      dayType: "workout",
      phase: a.phase,
      races,
      history: [],
      block: null,
      settings,
      profile,
      shortOnTime: a.sessionMinutes === 20,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function finish() {
    if (!profile) return;
    storage.saveSettings(settings);
    if (goalRace) storage.saveRaces([...data.races.filter((r) => r.id !== goalRace.id), goalRace]);
    storage.saveProfile(profile);
    router.replace("/");
  }

  if (building) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
        <p className="animate-rise text-lg font-semibold">Building your plan…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? router.back() : setStep(step - 1))}
            className={`-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-xl text-muted ${step === 0 && !p ? "invisible" : ""}`}
            aria-label="Back"
          >
            ‹
          </button>
          <div className="flex flex-1 gap-1">
            {steps.map((s, i) => (
              <span key={s.key} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= step ? "bg-accent" : "bg-line"}`} />
            ))}
          </div>
        </div>
      </div>

      <div key={current.key} className="animate-rise flex-1 pt-6">
        {current.key === "hello" && (
          <Step title="Let's build your lifting around your running." note="A few quick questions, about a minute.">
            <input
              className="w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-lg"
              placeholder="First name"
              value={a.name}
              autoComplete="given-name"
              onChange={(e) => set("name", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && next()}
            />
          </Step>
        )}

        {current.key === "events" && (
          <Step title={a.name.trim() ? `What do you run, ${a.name.trim()}?` : "What do you run?"}>
            <Options multi options={EVENT_OPTIONS} value={a.events} onPick={(v) => set("events", toggle(a.events, v))} />
          </Step>
        )}

        {current.key === "miles" && (
          <Step title="Miles per week?">
            <div className="rounded-3xl border border-line bg-card px-5 py-8 text-center">
              <p className="text-6xl font-bold tabular-nums tracking-tight text-accent">
                {a.weeklyMiles}
                <span className="ml-1.5 text-lg font-semibold tracking-normal text-muted">mi / week</span>
              </p>
              <input
                type="range"
                min={10}
                max={90}
                step={5}
                value={a.weeklyMiles}
                onChange={(e) => set("weeklyMiles", Number(e.target.value))}
                className="mt-6 w-full accent-[var(--accent)]"
                aria-label="Weekly miles"
              />
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>10</span>
                <span>90</span>
              </div>
            </div>
          </Step>
        )}

        {current.key === "experience" && (
          <Step title="Lifting experience?">
            <Options options={EXPERIENCE_OPTIONS} value={a.experience} onPick={(v) => choose("experience", v)} />
          </Step>
        )}

        {current.key === "equipment" && (
          <Step title="Where do you lift?">
            <Options options={EQUIPMENT_OPTIONS} value={a.equipment} onPick={(v) => choose("equipment", v)} />
          </Step>
        )}

        {current.key === "goals" && (
          <Step title="Your goals?" note="Pick up to 2">
            <Options
              multi
              options={GOAL_OPTIONS}
              value={a.goals}
              onPick={(v) =>
                set("goals", a.goals.includes(v) ? a.goals.filter((g) => g !== v) : a.goals.length >= 2 ? [a.goals[1], v] : [...a.goals, v])
              }
            />
          </Step>
        )}

        {current.key === "spots" && (
          <Step title="Any trouble spots?">
            <div className="flex flex-wrap gap-2">
              {SPOT_OPTIONS.map((s) => (
                <BigChip
                  key={s.value}
                  on={a.troubleSpots.includes(s.value)}
                  onClick={() => {
                    set("noTrouble", false);
                    set("troubleSpots", toggle(a.troubleSpots, s.value));
                  }}
                >
                  {s.label}
                </BigChip>
              ))}
              <BigChip
                on={a.noTrouble}
                onClick={() => {
                  set("troubleSpots", []);
                  set("noTrouble", true);
                }}
              >
                None
              </BigChip>
            </div>
          </Step>
        )}

        {current.key === "week" && (
          <Step title="Your week">
            <Question label="Meet day">
              <DayPicker value={[a.raceDay]} onToggle={(d) => set("raceDay", d)} />
            </Question>
            {a.raceDay === "thu" && (
              <Question label="Tune-up workout">
                <div className="flex gap-2">
                  <BigChip on={a.tuneUpDay === "mon"} onClick={() => set("tuneUpDay", "mon")}>Monday</BigChip>
                  <BigChip on={a.tuneUpDay === "tue"} onClick={() => set("tuneUpDay", "tue")}>Tuesday</BigChip>
                </div>
              </Question>
            )}
            <Question label="Workout days (no-meet weeks)">
              <DayPicker value={a.workoutDays} onToggle={(d) => set("workoutDays", toggle(a.workoutDays, d))} />
            </Question>
            <Question label="Time to lift">
              <div className="grid grid-cols-3 gap-2">
                {([20, 30, 45] as const).map((m) => (
                  <BigChip key={m} on={a.sessionMinutes === m} onClick={() => set("sessionMinutes", m)}>
                    {m} min
                  </BigChip>
                ))}
              </div>
            </Question>
          </Step>
        )}

        {current.key === "season" && (
          <Step title="Where are you in your season?">
            <div className="grid grid-cols-2 gap-2">
              {PHASE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set("phase", o.value)}
                  aria-pressed={a.phase === o.value}
                  className={`relative rounded-2xl border-2 px-3 py-4 text-left transition active:scale-[0.99] ${
                    a.phase === o.value ? "border-accent bg-accent-soft" : "border-line bg-card"
                  }`}
                >
                  <span className="text-2xl" aria-hidden>{o.icon}</span>
                  <span className="mt-1 block font-semibold">{PHASE_LABEL[o.value]}</span>
                  {suggestion.phase === o.value && data.races.length > 0 && (
                    <span className="absolute right-2 top-2 rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-good">
                      Suggested
                    </span>
                  )}
                </button>
              ))}
            </div>
            <p className="mt-3 text-sm text-muted">{PHASE_HINT[a.phase]}</p>
            <Question label="Goal race (optional)">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="min-w-0 rounded-2xl border border-line bg-card px-4 py-3"
                  placeholder="e.g. State meet"
                  value={a.goalRaceName}
                  onChange={(e) => set("goalRaceName", e.target.value)}
                />
                <input
                  type="date"
                  className="rounded-2xl border border-line bg-card px-3 py-3"
                  value={a.goalRaceDate}
                  min={today}
                  onChange={(e) => set("goalRaceDate", e.target.value)}
                  aria-label="Goal race date"
                />
              </div>
              {!current.ready && <p className="mt-1.5 text-xs text-warn">Add both a name and a date, or leave both empty.</p>}
            </Question>
            <button
              type="button"
              onClick={() => set("returnWeek", !a.returnWeek)}
              aria-pressed={a.returnWeek}
              className={`mt-6 flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition ${
                a.returnWeek ? "border-accent bg-accent-soft" : "border-line bg-card"
              }`}
            >
              <span className="flex-1">
                <span className="block font-semibold">Coming back from a break</span>
                <span className="block text-xs text-muted">Starts you on easy holds for a week.</span>
              </span>
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
                  a.returnWeek ? "border-accent bg-accent text-accent-ink" : "border-line"
                }`}
                aria-hidden
              >
                {a.returnWeek ? "✓" : ""}
              </span>
            </button>
          </Step>
        )}

        {current.key === "plan" && profile && <PlanReveal profile={profile} phase={a.phase} sample={sample} goalRace={goalRace} />}
      </div>

      {(!current.auto || current.ready) && (
        <div className="sticky bottom-0 -mx-4 -mb-6 mt-6 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
          <button
            type="button"
            disabled={!current.ready}
            onClick={isLast ? finish : next}
            className="w-full rounded-2xl bg-accent py-4 text-base font-semibold text-accent-ink shadow-sm transition active:scale-[0.99] disabled:opacity-40"
          >
            {isLast ? "Start training" : step === 0 ? "Let's go" : "Continue"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlanReveal({
  profile,
  phase,
  sample,
  goalRace,
}: {
  profile: Profile;
  phase: Phase;
  sample: ReturnType<typeof generateWorkout> | null;
  goalRace: Race | null;
}) {
  const goals = GOAL_OPTIONS.filter((g) => profile.goals.includes(g.value));
  return (
    <div>
      <h1 className="text-3xl font-bold leading-tight tracking-tight">{profile.name ? `${profile.name}, you're set.` : "You're set."}</h1>

      <div className="mt-6 space-y-3">
        <div className="rounded-3xl bg-accent p-5 text-accent-ink">
          <p className="text-2xl font-bold">{PHASE_LABEL[phase]}</p>
          <p className="mt-1 text-sm opacity-90">{PHASE_HINT[phase]}</p>
          {goalRace && <p className="mt-2 text-sm font-semibold">Goal: {goalRace.name}</p>}
        </div>

        {goals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {goals.map((g) => (
              <span key={g.value} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
                {g.icon} {g.label}
              </span>
            ))}
          </div>
        )}

        {sample && sample.items.length > 0 && (
          <div className="rounded-3xl border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">A workout day might look like</p>
            <div className="mt-1 flex items-baseline justify-between">
              <p className="font-semibold">{sample.title}</p>
              <span className="text-xs text-muted">~{sample.estMinutes} min</span>
            </div>
            <ol className="mt-3 divide-y divide-line">
              {sample.items.map((i, n) => (
                <li key={i.key} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-4 shrink-0 text-xs font-bold tabular-nums text-muted">{n + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{i.exercise.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted">
                    {i.sets} × {i.reps.replace(" max push", "")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="px-1 text-sm text-muted">Each day, tell the app what kind of run you did and tap Generate workout.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Step({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div>
      <h1 className="text-[1.8rem] font-bold leading-tight tracking-tight">{title}</h1>
      {note && <p className="mt-1 text-sm text-muted">{note}</p>}
      <div className="mt-6">{children}</div>
    </div>
  );
}

function Options<T extends string>({
  options,
  value,
  onPick,
  multi,
}: {
  options: { value: T; label: string; icon: string }[];
  value: T | T[] | null;
  onPick: (v: T) => void;
  multi?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {options.map((o) => {
        const on = Array.isArray(value) ? value.includes(o.value) : value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onPick(o.value)}
            aria-pressed={on}
            className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition active:scale-[0.99] ${
              on ? "border-accent bg-accent-soft" : "border-line bg-card"
            }`}
          >
            <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl ${on ? "bg-card" : "bg-card-2"}`} aria-hidden>
              {o.icon}
            </span>
            <span className="flex-1 text-lg font-semibold">{o.label}</span>
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center ${multi ? "rounded-md" : "rounded-full"} border-2 text-xs font-bold ${
                on ? "border-accent bg-accent text-accent-ink" : "border-line"
              }`}
              aria-hidden
            >
              {on ? "✓" : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function BigChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`min-h-12 rounded-2xl border-2 px-4 py-2.5 font-medium transition active:scale-[0.98] ${
        on ? "border-accent bg-accent-soft text-accent" : "border-line bg-card"
      }`}
    >
      {children}
    </button>
  );
}

function DayPicker({ value, onToggle }: { value: Weekday[]; onToggle: (d: Weekday) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAYS.map((d) => {
        const on = value.includes(d.value);
        return (
          <button
            key={d.value}
            type="button"
            onClick={() => onToggle(d.value)}
            aria-pressed={on}
            className={`h-12 rounded-xl border-2 text-xs font-semibold transition ${on ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-muted"}`}
          >
            {d.label}
          </button>
        );
      })}
    </div>
  );
}

function Question({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <p className="mb-2 text-sm font-semibold text-muted">{label}</p>
      {children}
    </div>
  );
}
