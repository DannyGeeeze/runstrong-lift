"use client";

import { RunRow } from "@/components/RunList";
import { Card, SectionTitle } from "@/components/ui";
import { addDays, formatDay, todayLocal } from "@/lib/dates";
import { dayType, RUN_TYPE_LABEL } from "@/lib/day";
import { ROTATION_TYPES, UPPER_FOCUS_LABEL, UPPER_FOCUSES, weekCounts } from "@/lib/rules";
import { miles } from "@/lib/strava";
import { storage } from "@/lib/storage";
import { useHydrated, useStore } from "@/lib/useStore";
import { useRuns } from "@/lib/useRuns";
import type { LiftLog } from "@/lib/types";

const SESSION_LABEL: Record<LiftLog["session"], string> = {
  full: "Full strength",
  short: "Short strength",
  "plyos-isos": "Plyos + Isos",
  taper: "Race-day isos",
  return: "Return isos",
  "touch-up": "Touch-up",
  upper: "Upper body",
  none: "None",
};

const PLYO_LABEL: Record<string, string> = {
  deep: "Deep",
  pogo: "Pogo",
  "single-leg-hop": "SL hop",
  lateral: "Lateral",
};

export default function WeekPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Week />;
}

function Week() {
  const { settings, history, overrides, races } = useStore();
  const { runs, loading, source } = useRuns(settings.mockMode);
  const today = todayLocal();
  const counts = weekCounts(history, today);
  const upperDone = new Set(history.filter((h) => h.date > addDays(today, -7) && h.date <= today).map((h) => h.upperFocus));
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const weekMiles = runs
    .filter((r) => r.date > addDays(today, -7))
    .reduce((s, r) => s + r.distanceM, 0);
  const older = runs.filter((r) => r.date <= addDays(today, -7)).sort((a, b) => b.startLocal.localeCompare(a.startLocal));

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Last 7 days</h1>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Strength" value={`${counts.strength}/2`} full={counts.strength >= 2} />
        <Stat label="Plyo" value={`${counts.plyo}/2`} full={counts.plyo >= 2} />
        <Stat label="Miles" value={loading ? "…" : miles(weekMiles)} />
      </div>

      <Card className="mt-2 py-3">
        <p className="mb-2 text-xs font-medium text-muted">Plyo categories this week</p>
        <div className="flex flex-wrap gap-2">
          {ROTATION_TYPES.map((t) => (
            <Check key={t} done={counts.plyoTypes.includes(t)} label={PLYO_LABEL[t]} />
          ))}
        </div>
        <p className="mb-2 mt-3 text-xs font-medium text-muted">Upper body this week</p>
        <div className="flex flex-wrap gap-2">
          {UPPER_FOCUSES.map((f) => (
            <Check key={f} done={upperDone.has(f)} label={UPPER_FOCUS_LABEL[f]} />
          ))}
        </div>
      </Card>

      <SectionTitle>Day by day {source === "mock" && <span className="normal-case">(demo runs)</span>}</SectionTitle>
      <div className="space-y-2">
        {days.map((date) => {
          const d = dayType(date, runs, overrides, races);
          const lifts = history.filter((h) => h.date === date);
          return (
            <Card key={date} className="py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{date === today ? "Today" : formatDay(date)}</p>
                <span className="rounded-full bg-card-2 px-2 py-0.5 text-xs font-medium">{RUN_TYPE_LABEL[d.type]}</span>
              </div>
              {d.runs.length > 0 && (
                <div className="divide-y divide-line">
                  {d.runs.map((r) => (
                    <RunRow key={r.id} run={r} />
                  ))}
                </div>
              )}
              {lifts.map((l) => (
                <div key={l.id} className="mt-2 flex items-center justify-between rounded-lg bg-accent-soft px-3 py-2">
                  <span className="text-sm font-medium text-accent">
                    {l.upperFocus ? UPPER_FOCUS_LABEL[l.upperFocus] : SESSION_LABEL[l.session]}
                    {l.volume === "half" ? " (half)" : ""} · {l.exerciseIds.length} moves
                  </span>
                  <button
                    type="button"
                    className="text-xs text-muted underline"
                    onClick={() => confirm("Delete this lift from history?") && storage.deleteLift(l.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
              {d.runs.length === 0 && lifts.length === 0 && <p className="mt-1 text-xs text-muted">Nothing logged.</p>}
            </Card>
          );
        })}
      </div>

      {older.length > 0 && (
        <>
          <SectionTitle>Days 8–14</SectionTitle>
          <Card className="divide-y divide-line py-1">
            {older.map((r) => (
              <div key={r.id}>
                <p className="pt-2 text-xs text-muted">{formatDay(r.date)}</p>
                <RunRow run={r} />
              </div>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <Card className="px-3 py-3 text-center">
      <p className={`text-2xl font-bold ${full ? "text-accent" : ""}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </Card>
  );
}

function Check({ done, label }: { done: boolean; label: string }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${done ? "bg-good-soft text-good" : "bg-card-2 text-muted"}`}>
      {done ? "✓ " : ""}
      {label}
    </span>
  );
}
