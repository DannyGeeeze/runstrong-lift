"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RunRow } from "@/components/RunList";
import { LiveWorkout } from "@/components/LiveWorkout";
import { WorkoutCard } from "@/components/WorkoutCard";
import { Button, Card, Chip, Notice, SectionTitle, Toggle } from "@/components/ui";
import { addDays, diffDays, formatDay, todayLocal } from "@/lib/dates";
import { dayType, futureHardOverrides, RUN_TYPE_LABEL } from "@/lib/day";
import {
  addToBlock,
  decideCatchUp,
  EASY_SESSIONS,
  decideSession,
  generateWorkout,
  PHASE_LABEL,
  toLiftLog,
  type GenerateInput,
  type Workout,
} from "@/lib/rules";
import { newId, storage } from "@/lib/storage";
import { useHydrated, useStore } from "@/lib/useStore";
import { useRuns } from "@/lib/useRuns";
import type { EasyFocus, LiftLog, RunType } from "@/lib/types";

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
  return: "Return isos",
  "touch-up": "Touch-up",
  upper: "Upper body",
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
  const { settings, races, history, overrides, block, profile } = data;
  const runsState = useRuns(settings.mockMode);
  const { runs, source, status, loading, error } = runsState;
  const today = todayLocal();
  const [shortOnTime, setShortOnTime] = useState(profile?.sessionMinutes === 20);
  const [mode, setMode] = useState<"today" | "catchup">("today");
  const [state, setState] = useState<{ sig: string; workout: Workout; done: Set<string> } | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  // Easy days default to upper body (touch-up the week before an A race); tapping overrides it.
  const [easyPick, setEasyPick] = useState<EasyFocus | undefined>(undefined);
  const easyFocus = easyPick;

  const day = dayType(today, runs, overrides, races);
  const yesterday = dayType(addDays(today, -1), runs, overrides, races);

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
      extraHardDays: futureHardOverrides(today, overrides),
    }),
    [today, day.type, settings, races, history, block, profile, shortOnTime, easyFocus, overrides],
  );

  const preview = decideSession(ctx);
  const easyDay = preview.role === "easy" || preview.role === "long";
  const todayIsLift = !EASY_SESSIONS.includes(preview.session) && preview.session !== "none";
  const catchUp = !todayIsLift ? decideCatchUp(ctx, loading ? undefined : yesterday.type) : null;
  const sig = JSON.stringify([today, day.type, settings, races, profile, shortOnTime, easyFocus, mode]);
  const current = state?.sig === sig ? state : null;
  const loggedToday = history.filter((h) => h.date === today);

  const nextRace = races.find((r) => r.date >= today);

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

  return (
    <div>
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{formatDay(today)}</p>
          <h1 className="text-2xl font-bold tracking-tight">{profile?.name ? `Hey, ${profile.name}` : "RunStrong Lift"}</h1>
        </div>
        {nextRace && (
          <Link href="/races" className="rounded-xl bg-card px-3 py-2 text-right text-xs shadow-sm ring-1 ring-line">
            <span className="block font-semibold">{nextRace.name}</span>
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

      <SectionTitle right={<Link href="/settings" className="text-xs font-medium text-accent">{PHASE_LABEL[settings.phase]}</Link>}>
        Today&apos;s run
      </SectionTitle>
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
        <div className="mt-3 flex flex-wrap gap-2">
          {TYPES.map((t) => (
            <Chip
              key={t}
              active={day.type === t}
              onClick={() => storage.setOverride(today, overrides[today] === t ? null : t)}
            >
              {RUN_TYPE_LABEL[t]}
            </Chip>
          ))}
        </div>
      </Card>

      {catchUp && "blocked" in catchUp && (
        <div className="mt-4">
          <Notice tone="warn">{catchUp.blocked}</Notice>
        </div>
      )}
      {catchUp && "session" in catchUp && (
        <Card className="mt-4">
          <Toggle
            checked={mode === "catchup"}
            onChange={(v) => setMode(v ? "catchup" : "today")}
            label="Lift this morning for yesterday"
          />
        </Card>
      )}

      <SectionTitle>Lift</SectionTitle>
      {loggedToday.length > 0 && (
        <div className="mb-3">
          <Notice tone="good">
            Logged today: {loggedToday.map((l) => LOGGED_LABEL[l.session] + (l.volume === "half" ? " (half)" : "")).join(", ")}.
          </Notice>
        </div>
      )}
      {saved && (
        <div className="mb-3">
          <Notice tone="good">Saved “{saved}” to your history.</Notice>
        </div>
      )}

      <div className="space-y-3">
        {(mode === "today" ? preview.strength : catchUp && "session" in catchUp && catchUp.strength) && (
          <Card className="py-1">
            <Toggle checked={shortOnTime} onChange={setShortOnTime} label="Short on time (20 min)" />
          </Card>
        )}

        {easyDay && mode === "today" && (
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-card p-1 ring-1 ring-line">
            {EASY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={preview.session === o.value}
                onClick={() => setEasyPick(o.value)}
                className={`min-h-10 rounded-lg px-1 text-sm font-semibold transition-colors ${
                  preview.session === o.value ? "bg-accent text-accent-ink" : "text-muted"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        {!current && (
          <>
            {preview.session === "touch-up" && mode === "today" && profile?.goals.includes("healthy") && (
              <Notice tone="good">Recommended for staying healthy</Notice>
            )}
            <p className="text-sm text-muted">
              <span className="font-medium text-ink">{(mode === "catchup" && catchUp && "session" in catchUp ? catchUp : preview).why}</span>
            </p>
            {preview.session !== "none" || mode === "catchup" ? (
              <Button variant="primary" className="w-full py-4 text-base" onClick={() => generate(0)} disabled={loading}>
                Generate workout
              </Button>
            ) : (
              <Notice>Rest day. Nothing to lift.</Notice>
            )}
          </>
        )}

        {current && (
          <>
            <WorkoutCard workout={current.workout} done={current.done} onToggle={toggleDone} history={history} />
            {current.workout.items.length > 0 && (
              <Button variant="primary" className="w-full py-4 text-base" onClick={() => setLive(true)}>
                ▶ Start workout
              </Button>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => generate(current.workout.attempt + 1)}>Regenerate</Button>
              <Button onClick={() => complete()} disabled={current.workout.items.length === 0}>
                Mark complete
              </Button>
            </div>
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
  );
}
