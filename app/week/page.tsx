"use client";

import { useState, type ReactNode } from "react";
import { RunRow } from "@/components/RunList";
import { Card, SectionTitle } from "@/components/ui";
import { addDays, formatDay, todayLocal } from "@/lib/dates";
import { dayType, RUN_TYPE_LABEL } from "@/lib/day";
import { RECOVERY_LABEL, ROTATION_TYPES, SAUNA_PER_WEEK, UPPER_FOCUS_LABEL, UPPER_FOCUSES, weekCounts } from "@/lib/rules";
import { miles } from "@/lib/strava";
import { storage } from "@/lib/storage";
import { useHydrated, useStore } from "@/lib/useStore";
import { useRuns } from "@/lib/useRuns";
import type { LiftLog, RunType, UpperFocus } from "@/lib/types";

const SESSION_LABEL: Record<LiftLog["session"], string> = {
  full: "Full strength",
  short: "Short strength",
  "plyos-isos": "Plyos + Isos",
  taper: "Race-day isos",
  return: "Week-off isos",
  "touch-up": "Touch-up",
  upper: "Upper body",
  "long-isos": "Long-run isos",
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
  const { settings, history, overrides, races, recovery } = useStore();
  const { runs, loading, source } = useRuns(settings.mockMode);
  const today = todayLocal();
  const counts = weekCounts(history, today);
  const recent = recovery.filter((r) => r.date > addDays(today, -7) && r.date <= today);
  const boots = recent.filter((r) => r.kind === "boots").length;
  const saunas = recent.filter((r) => r.kind === "sauna").length;
  const upperDone = new Set(history.filter((h) => h.date > addDays(today, -7) && h.date <= today).map((h) => h.upperFocus));
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const weekMiles = runs
    .filter((r) => r.date > addDays(today, -7))
    .reduce((s, r) => s + r.distanceM, 0);
  const older = runs.filter((r) => r.date <= addDays(today, -7)).sort((a, b) => b.startLocal.localeCompare(a.startLocal));

  const [showOlder, setShowOlder] = useState(false);

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">This week</h1>
      <p className="mt-0.5 text-sm text-muted">
        Last 7 days{source === "mock" ? " · demo runs" : ""}
      </p>

      <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="lg:sticky lg:top-0">
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Strength" value={`${counts.strength}/2`} full={counts.strength >= 2} />
        <Stat label="Plyo" value={`${counts.plyo}/2`} full={counts.plyo >= 2} />
        <Stat label="Miles" value={loading ? "…" : miles(weekMiles)} />
      </div>

      <Card className="mt-2 space-y-3 py-3.5">
        <CheckRow label="Plyo types">
          {ROTATION_TYPES.map((t) => (
            <Check key={t} done={counts.plyoTypes.includes(t)} label={PLYO_LABEL[t]} />
          ))}
        </CheckRow>
        <CheckRow label="Upper body">
          {UPPER_FOCUSES.map((f) => (
            <Check key={f} done={upperDone.has(f)} label={UPPER_SHORT[f]} />
          ))}
        </CheckRow>
        {(settings.hasBoots || settings.hasSauna) && (
          <CheckRow label="Recovery">
            {settings.hasBoots && <Check done={boots > 0} label={boots > 0 ? `Boots × ${boots}` : "Boots"} />}
            {settings.hasSauna && <Check done={saunas > 0} label={`Sauna ${saunas}/${SAUNA_PER_WEEK}`} />}
          </CheckRow>
        )}
      </Card>

      </div>

      <div className="min-w-0">
      <SectionTitle>Day by day</SectionTitle>
      <Card className="divide-y divide-line py-0">
        {days.map((date) => {
          const d = dayType(date, runs, overrides, races);
          const lifts = history.filter((h) => h.date === date);
          const recs = recovery.filter((r) => r.date === date);
          const isToday = date === today;
          return (
            <div key={date} className="flex gap-3 py-3">
              <div className="w-11 shrink-0 pt-0.5 text-center">
                <p className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-accent" : "text-muted"}`}>
                  {isToday ? "Today" : weekday(date)}
                </p>
                <p className={`text-lg font-bold leading-tight tabular-nums ${isToday ? "text-accent" : ""}`}>{dayNum(date)}</p>
              </div>
              <div className="min-w-0 flex-1">
                <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_STYLE[d.type]}`}>
                  {RUN_TYPE_LABEL[d.type]}
                </span>
                {d.runs.map((r) => (
                  <RunRow key={r.id} run={r} compact />
                ))}
                {(lifts.length > 0 || recs.length > 0) && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {lifts.map((l) => (
                      <LogChip
                        key={l.id}
                        tone="lift"
                        label={`${l.upperFocus ? UPPER_FOCUS_LABEL[l.upperFocus] : SESSION_LABEL[l.session]}${l.volume === "half" ? " (half)" : ""}${l.exerciseIds.length ? ` · ${l.exerciseIds.length} moves` : ""}`}
                        onDelete={() => confirm("Delete this lift from history?") && storage.deleteLift(l.id)}
                      />
                    ))}
                    {recs.map((r) => (
                      <LogChip
                        key={r.id}
                        tone="recovery"
                        label={RECOVERY_LABEL[r.kind]}
                        onDelete={() => confirm(`Delete this ${RECOVERY_LABEL[r.kind].toLowerCase()} session?`) && storage.deleteRecovery(r.id)}
                      />
                    ))}
                  </div>
                )}
                {d.runs.length === 0 && lifts.length === 0 && recs.length === 0 && (
                  <p className="mt-0.5 text-xs text-muted">Nothing logged</p>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {older.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowOlder((v) => !v)}
            aria-expanded={showOlder}
            className="mt-4 min-h-11 w-full rounded-xl text-sm font-medium text-muted"
          >
            {showOlder ? "Hide days 8–14" : `Show days 8–14 · ${older.length} runs`}
          </button>
          {showOlder && (
            <Card className="divide-y divide-line py-1">
              {older.map((r) => (
                <div key={r.id} className="flex gap-3 py-1.5">
                  <p className="w-14 shrink-0 pt-2.5 text-xs text-muted">{weekday(r.date)} {dayNum(r.date)}</p>
                  <div className="min-w-0 flex-1">
                    <RunRow run={r} />
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}
      </div>
      </div>
    </div>
  );
}

const UPPER_SHORT: Record<UpperFocus, string> = { back: "Back", chest: "Chest", shoulders: "Shoulders" };

const TYPE_STYLE: Record<RunType, string> = {
  easy: "bg-card-2 text-muted",
  long: "bg-card-2 text-ink",
  workout: "bg-accent-soft text-accent",
  race: "bg-accent text-accent-ink",
  rest: "bg-card-2 text-muted",
};

const weekday = (date: string) => formatDay(date).split(",")[0].split(" ")[0];
const dayNum = (date: string) => String(Number(date.slice(8, 10)));

function CheckRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <p className="w-20 shrink-0 pt-1 text-xs font-medium text-muted">{label}</p>
      <div className="flex flex-1 flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function LogChip({ label, tone, onDelete }: { label: string; tone: "lift" | "recovery"; onDelete: () => void }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-semibold ${
        tone === "lift" ? "bg-accent-soft text-accent" : "bg-good-soft text-good"
      }`}
    >
      {label}
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
        className="flex h-6 w-6 items-center justify-center rounded-full text-sm opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </span>
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
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${done ? "bg-good-soft text-good" : "bg-card-2 text-muted"}`}>
      {done ? "✓ " : ""}
      {label}
    </span>
  );
}
