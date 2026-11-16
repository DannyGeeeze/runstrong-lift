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
import { ALL_EXERCISES } from "@/lib/exercises";
import { generateWorkout, PHASE_LABEL, suggestPhase } from "@/lib/rules";
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

const PHASE_OPTIONS: { value: Phase; hint: string; icon: string }[] = [
  { value: "off", hint: "No races for a while. Building the base.", icon: "🌤️" },
  { value: "early", hint: "First few meets. Still building.", icon: "🌱" },
  { value: "deep", hint: "Racing most weeks. Grinding.", icon: "🔥" },
  { value: "championship", hint: "League, sectionals, states. Time to peak.", icon: "🏆" },
];

/** What the coach's system does in your race week, per phase. */
const PHASE_WEEK: Record<Phase, string> = {
  off: "Full sessions after workouts, using all 7 slots plus one upper-body move.",
  early: "Full session after your workout, and another Full session after you race.",
  deep: "Full session after your workout. Race day: a half-volume lift or plyos + isos.",
  championship: "Just plyos + isos after your workout. Race day: rest, or a few isos.",
};

const RACE_DISTANCE: Record<EventFocus, string> = { xc: "5K", distance: "3200m", mid: "1600m", long: "10K" };

function milesReaction(m: number) {
  if (m < 25) return "Nice and easy. Strength work will help you stay durable as it climbs.";
  if (m < 40) return "Solid base. Lifting will make every one of those miles count more.";
  if (m < 60) return "That's a real varsity load. We'll keep lifts short so you recover.";
  return "Big miles. Lifting is your armor: low volume, high quality.";
}

interface Answers {
  name: string;
  event: EventFocus | null;
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

function Onboarding() {
  const router = useRouter();
  const data = useStore();
  const today = todayLocal();
  const existingA = data.races.find((r) => r.priority === "A" && r.date >= today);
  const suggestion = suggestPhase(data.races, today);
  const p = data.profile;

  const [a, setA] = useState<Answers>(() => ({
    name: p?.name ?? "",
    event: p?.event ?? null,
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
  const first = a.name.trim() ? a.name.trim() : null;

  const steps: { key: string; ready: boolean; auto?: boolean }[] = [
    { key: "hello", ready: true },
    { key: "event", ready: !!a.event, auto: true },
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
      // Short "building" beat before the plan reveal.
      setBuilding(true);
      setTimeout(() => {
        setBuilding(false);
        setStep(step + 1);
      }, 1100);
      return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  // Single-choice questions move on by themselves after a tap.
  function choose<K extends keyof Answers>(k: K, v: Answers[K]) {
    set(k, v);
    setTimeout(() => setStep((s) => s + 1), 280);
  }

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const profile: Profile | null =
    a.event && a.experience && a.equipment
      ? {
          name: a.name.trim(),
          event: a.event,
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
          distance: existingA?.distance ?? RACE_DISTANCE[a.event ?? "xc"],
          priority: "A",
        }
      : null;

  const sample = useMemo(() => {
    if (step !== steps.length - 1 || !profile) return null;
    // Preview a workout-day session for the next tune-up day under these answers.
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
    if (goalRace) {
      const others = data.races.filter((r) => r.id !== goalRace.id);
      storage.saveRaces([...others, goalRace]);
    }
    storage.saveProfile(profile);
    router.replace("/");
  }

  if (building) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-5 text-center">
        <div className="h-14 w-14 animate-spin rounded-full border-4 border-accent-soft border-t-accent" />
        <p className="animate-rise text-lg font-semibold">Building your plan{first ? `, ${first}` : ""}…</p>
        <p className="text-sm text-muted">Matching {ALL_EXERCISES.length} exercises to your answers</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col">
      {/* Progress */}
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
          <span className="w-10 text-right text-xs tabular-nums text-muted">
            {step + 1}/{steps.length}
          </span>
        </div>
      </div>

      <div key={current.key} className="animate-rise flex-1 pt-4">
        {current.key === "hello" && (
          <Step
            kicker="RunStrong Lift"
            title="Let's build your lifting around your running."
            why="A few quick questions (about 2 minutes) so every session fits your training, your gear and your goals."
          >
            <label className="block">
              <span className="text-sm font-medium">What should we call you?</span>
              <input
                className="mt-2 w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-lg"
                placeholder="First name (optional)"
                value={a.name}
                autoComplete="given-name"
                onChange={(e) => set("name", e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && next()}
              />
            </label>
            <ul className="mt-6 space-y-3 text-sm text-muted">
              <li className="flex gap-3"><Dot />Run first, then lift. We read today&apos;s run from Strava.</li>
              <li className="flex gap-3"><Dot />Sessions shift with your races, so you show up fresh.</li>
              <li className="flex gap-3"><Dot />Based on @the_runstrong_coach&apos;s system for distance runners.</li>
            </ul>
          </Step>
        )}

        {current.key === "event" && (
          <Step
            kicker={first ? `Nice to meet you, ${first}` : "About your running"}
            title="What's your main event?"
            why="Shorter events lean more on power and plyos. Longer ones lean on durability."
          >
            <Options options={EVENT_OPTIONS} value={a.event} onPick={(v) => choose("event", v)} />
          </Step>
        )}

        {current.key === "miles" && (
          <Step title="How many miles a week, roughly?" why="More miles means less room for lifting volume. We keep sessions short and sharp so they never steal from your running.">
            <div className="rounded-3xl border border-line bg-card px-5 py-8 text-center">
              <p className="text-6xl font-bold tabular-nums tracking-tight text-accent">{a.weeklyMiles}</p>
              <p className="mt-1 text-sm text-muted">miles per week</p>
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
                <span>90+</span>
              </div>
            </div>
            <p className="mt-4 text-sm font-medium">{milesReaction(a.weeklyMiles)}</p>
          </Step>
        )}

        {current.key === "experience" && (
          <Step title="How much lifting have you done?" why="New lifters start with movements that are easy to learn and hard to mess up. The heavy barbell stuff and Nordics come later.">
            <Options options={EXPERIENCE_OPTIONS} value={a.experience} onPick={(v) => choose("experience", v)} />
          </Step>
        )}

        {current.key === "equipment" && (
          <Step title="Where will you usually lift?" why="We only pick exercises you can actually do with what you have. No barbell? No problem.">
            <Options options={EQUIPMENT_OPTIONS} value={a.equipment} onPick={(v) => choose("equipment", v)} />
          </Step>
        )}

        {current.key === "goals" && (
          <Step title="What do you want out of lifting?" why="Pick up to 2. A faster kick or better efficiency adds an extra plyo to your full sessions. Staying healthy puts the easy-day touch-ups front and center.">
            <Options
              multi
              options={GOAL_OPTIONS}
              value={a.goals}
              onPick={(v) =>
                set(
                  "goals",
                  a.goals.includes(v) ? a.goals.filter((g) => g !== v) : a.goals.length >= 2 ? [a.goals[1], v] : [...a.goals, v],
                )
              }
            />
          </Step>
        )}

        {current.key === "spots" && (
          <Step title="Anything that tends to get cranky?" why="Past or nagging spots get extra attention. Calf and foot work for shins, hip work for IT band issues, and so on. This isn't medical advice: if something hurts now, see a trainer or PT.">
            <div className="flex flex-wrap gap-2">
              {SPOT_OPTIONS.map((s) => {
                const on = a.troubleSpots.includes(s.value);
                return (
                  <BigChip
                    key={s.value}
                    on={on}
                    onClick={() => {
                      set("noTrouble", false);
                      set("troubleSpots", on ? a.troubleSpots.filter((x) => x !== s.value) : [...a.troubleSpots, s.value]);
                    }}
                  >
                    {s.label}
                  </BigChip>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                set("troubleSpots", []);
                set("noTrouble", true);
              }}
              className={`mt-4 w-full rounded-2xl border-2 px-4 py-4 text-left font-semibold transition ${
                a.noTrouble ? "border-good bg-good-soft text-good" : "border-line bg-card"
              }`}
            >
              {a.noTrouble ? "✓ " : ""}Nope, I feel good
            </button>
          </Step>
        )}

        {current.key === "week" && (
          <Step title="What does your week look like?" why="Lifting happens after hard days and has to stay 48 hours clear of the next one. Your schedule tells us where the lifts fit.">
            <Question label="Meets are usually on…">
              <DayPicker value={[a.raceDay]} onToggle={(d) => set("raceDay", d)} />
            </Question>
            {a.raceDay === "thu" && (
              <Question label="Your tune-up workout before a Thursday meet is…">
                <div className="flex gap-2">
                  <BigChip on={a.tuneUpDay === "mon"} onClick={() => set("tuneUpDay", "mon")}>Monday</BigChip>
                  <BigChip on={a.tuneUpDay === "tue"} onClick={() => set("tuneUpDay", "tue")}>Tuesday</BigChip>
                </div>
              </Question>
            )}
            <Question label="In weeks with no meet, hard workouts are on…">
              <DayPicker
                value={a.workoutDays}
                onToggle={(d) => set("workoutDays", a.workoutDays.includes(d) ? a.workoutDays.filter((x) => x !== d) : [...a.workoutDays, d])}
              />
            </Question>
            <Question label="Time you usually have to lift">
              <div className="grid grid-cols-3 gap-2">
                {([20, 30, 45] as const).map((m) => (
                  <BigChip key={m} on={a.sessionMinutes === m} onClick={() => set("sessionMinutes", m)}>
                    {m} min
                  </BigChip>
                ))}
              </div>
              {a.sessionMinutes === 20 && <p className="mt-2 text-xs text-muted">We&apos;ll default to the coach&apos;s 20-minute session.</p>}
            </Question>
          </Step>
        )}

        {current.key === "season" && (
          <Step title="Where are you in your season?" why="Early in the season you lift heavier. As big races get close, lifting gets lighter so your legs stay fresh.">
            <div className="space-y-2">
              {PHASE_OPTIONS.map((o) => (
                <OptionCard
                  key={o.value}
                  icon={o.icon}
                  label={PHASE_LABEL[o.value]}
                  hint={o.hint}
                  on={a.phase === o.value}
                  badge={suggestion.phase === o.value && data.races.length > 0 ? "Suggested" : undefined}
                  onClick={() => set("phase", o.value)}
                />
              ))}
            </div>
            <Question label="Your goal race this season (optional)">
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  className="min-w-0 rounded-2xl border border-line bg-card px-4 py-3"
                  placeholder="e.g. League champs"
                  value={a.goalRaceName}
                  onChange={(e) => set("goalRaceName", e.target.value)}
                />
                <input
                  type="date"
                  className="rounded-2xl border border-line bg-card px-3 py-3"
                  value={a.goalRaceDate}
                  min={today}
                  onChange={(e) => set("goalRaceDate", e.target.value)}
                />
              </div>
              <p className="mt-2 text-xs text-muted">We&apos;ll add it as an A race and taper your lifting into it.</p>
            </Question>
            <div className="mt-5 rounded-2xl border border-line bg-card px-4">
              <label className="flex cursor-pointer items-center justify-between gap-4 py-4">
                <span>
                  <span className="block font-medium">Coming back from a break?</span>
                  <span className="block text-xs text-muted">Injury, illness or time off: we&apos;ll start with gentle holds for a week.</span>
                </span>
                <input type="checkbox" className="h-6 w-6 accent-[var(--accent)]" checked={a.returnWeek} onChange={(e) => set("returnWeek", e.target.checked)} />
              </label>
            </div>
          </Step>
        )}

        {current.key === "plan" && profile && (
          <PlanReveal profile={profile} phase={a.phase} sample={sample} goalRace={goalRace} returnWeek={a.returnWeek} />
        )}
      </div>

      {/* Footer button */}
      {!current.auto && (
        <div className="sticky bottom-0 -mx-4 mt-6 bg-gradient-to-t from-bg via-bg to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-6">
          <button
            type="button"
            disabled={!current.ready}
            onClick={isLast ? finish : next}
            className="w-full rounded-2xl bg-accent py-4 text-base font-semibold text-accent-ink shadow-sm transition active:scale-[0.99] disabled:opacity-40"
          >
            {isLast ? "Start training" : step === 0 ? "Let's go" : step === steps.length - 2 ? "Build my plan" : "Continue"}
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
  returnWeek,
}: {
  profile: Profile;
  phase: Phase;
  sample: ReturnType<typeof generateWorkout> | null;
  goalRace: Race | null;
  returnWeek: boolean;
}) {
  const exp = EXPERIENCE_OPTIONS.find((o) => o.value === profile.experience)!;
  const gear = EQUIPMENT_OPTIONS.find((o) => o.value === profile.equipment)!;
  const goals = GOAL_OPTIONS.filter((g) => profile.goals.includes(g.value));
  const spots = SPOT_OPTIONS.filter((s) => profile.troubleSpots.includes(s.value)).map((s) => s.label.toLowerCase());

  const tailored: string[] = [];
  if (profile.experience === "new") tailored.push("Beginner-friendly picks: no heavy barbell work or Nordics until you're ready.");
  if (profile.equipment !== "gym") tailored.push(`Only moves you can do with your ${gear.label.toLowerCase()} gear.`);
  if (profile.goals.includes("kick") || profile.goals.includes("economy")) tailored.push("Two plyos in every full session for pop and spring.");
  if (profile.goals.includes("healthy")) tailored.push("10-minute touch-ups on easy days, recommended rather than optional.");
  if (spots.length) tailored.push(`Extra attention on your ${spots.join(", ")}.`);
  if (profile.sessionMinutes === 20) tailored.push("20-minute sessions by default.");
  if (returnWeek) tailored.push("First week back: gentle yielding holds only.");

  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-wider text-accent">Your plan</p>
      <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight">
        {profile.name ? `${profile.name}, you're set.` : "You're set."}
      </h1>
      <p className="mt-2 text-muted">
        {exp.icon} {exp.label} · {gear.icon} {gear.label} · {profile.weeklyMiles} mi/week
      </p>

      <div className="mt-5 space-y-3">
        <div className="rounded-3xl bg-accent p-5 text-accent-ink">
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80">{PHASE_LABEL[phase]}</p>
          <p className="mt-1 text-lg font-semibold leading-snug">{PHASE_WEEK[phase]}</p>
          {goalRace && <p className="mt-2 text-sm opacity-90">Peaking for {goalRace.name}.</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Stat big="2" small="strength sessions a week, max" />
          <Stat big="48h" small="clear before every hard day" />
        </div>

        {goals.length > 0 && (
          <div className="rounded-3xl border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Training for</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {goals.map((g) => (
                <span key={g.value} className="rounded-full bg-accent-soft px-3 py-1.5 text-sm font-medium text-accent">
                  {g.icon} {g.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {tailored.length > 0 && (
          <div className="rounded-3xl border border-line bg-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Tailored to you</p>
            <ul className="mt-2 space-y-2 text-sm">
              {tailored.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-0.5 text-good">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        )}

        {sample && sample.items.length > 0 && (
          <div className="rounded-3xl border border-line bg-card p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">A workout day could look like</p>
              <span className="text-xs text-muted">~{sample.estMinutes} min</span>
            </div>
            <p className="mt-1 font-semibold">{sample.title}</p>
            <ol className="mt-3 space-y-2">
              {sample.items.map((i, idx) => (
                <li key={i.key} className="flex items-center gap-3 text-sm" style={{ animationDelay: `${idx * 60}ms` }}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-card-2 text-[11px] font-bold text-muted">{i.slot}</span>
                  <span className="flex-1">{i.exercise.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {i.sets}×{i.reps.replace(" max push", "")}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="px-1 text-xs text-muted">You can change any of this later in Settings.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small pieces

function Step({ kicker, title, why, children }: { kicker?: string; title: string; why: string; children: ReactNode }) {
  return (
    <div>
      {kicker && <p className="text-sm font-semibold uppercase tracking-wider text-accent">{kicker}</p>}
      <h1 className="mt-1 text-[1.7rem] font-bold leading-tight tracking-tight">{title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{why}</p>
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
  options: { value: T; label: string; hint: string; icon: string }[];
  value: T | T[] | null;
  onPick: (v: T) => void;
  multi?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      {options.map((o) => {
        const on = Array.isArray(value) ? value.includes(o.value) : value === o.value;
        return <OptionCard key={o.value} icon={o.icon} label={o.label} hint={o.hint} on={on} multi={multi} onClick={() => onPick(o.value)} />;
      })}
    </div>
  );
}

function OptionCard({
  icon,
  label,
  hint,
  on,
  multi,
  badge,
  onClick,
}: {
  icon: string;
  label: string;
  hint: string;
  on: boolean;
  multi?: boolean;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-3.5 text-left transition active:scale-[0.99] ${
        on ? "border-accent bg-accent-soft" : "border-line bg-card"
      }`}
    >
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${on ? "bg-card" : "bg-card-2"}`} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="font-semibold">{label}</span>
          {badge && <span className="rounded-full bg-good-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-good">{badge}</span>}
        </span>
        <span className="mt-0.5 block text-sm text-muted">{hint}</span>
      </span>
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
      <p className="mb-2 text-sm font-semibold">{label}</p>
      {children}
    </div>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="rounded-3xl border border-line bg-card p-4">
      <p className="text-3xl font-bold tracking-tight">{big}</p>
      <p className="mt-0.5 text-xs text-muted">{small}</p>
    </div>
  );
}

function Dot() {
  return <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />;
}
