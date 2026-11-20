"use client";

import { useState, type ReactNode } from "react";
import { RunRow } from "@/components/RunList";
import { RunTypePicker } from "@/components/RunTypePicker";
import { LiftsChart, MilesChart, type LiftWeek, type MilesDay } from "@/components/WeekCharts";
import { Card, SectionTitle } from "@/components/ui";
import { addDays, formatDay, mondayOf, todayLocal } from "@/lib/dates";
import { dayType, RUN_TYPE_LABEL, type DaySource } from "@/lib/day";
import { EASY_SESSIONS, PLYO_FAMILY_LABEL, plyoFamily, type PlyoFamily, RECOVERY_LABEL, SAUNA_PER_WEEK, UPPER_FOCUS_LABEL, UPPER_FOCUSES } from "@/lib/rules";
import { METERS_PER_MILE, miles } from "@/lib/strava";
import { getExercise } from "@/lib/exercises";
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

const PLYO_FAMILIES: PlyoFamily[] = ["updown", "skip", "single", "lateral"];

export default function WeekPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Week />;
}

function Week() {
  const { settings, history, overrides, races, recovery } = useStore();
  const { runs, loading, source } = useRuns(settings.mockMode);
  const today = todayLocal();
  // "This week" is the calendar week, Monday to Sunday. (The lifting caps in the rules still
  // count the last 7 days, so a session last weekend can still matter on Monday.)
  const monday = mondayOf(today);
  const thisWeek = (date: string) => date >= monday && date <= today;
  const weekLifts = history.filter((h) => thisWeek(h.date));
  const counts = { strength: weekLifts.filter((h) => h.hadStrength).length, plyo: weekLifts.filter((h) => h.hadPlyo).length };
  const recent = recovery.filter((r) => thisWeek(r.date));
  const boots = recent.filter((r) => r.kind === "boots").length;
  const saunas = recent.filter((r) => r.kind === "sauna").length;
  // The coach's plyo template: which of its four kinds of move you did in the last 7 days.
  const plyoDone = new Set(
    history
      .filter((h) => thisWeek(h.date))
      .flatMap((h) => h.exerciseIds)
      .map((id) => getExercise(id))
      .flatMap((e) => (e ? [plyoFamily(e)] : [])),
  );
  const upperDone = new Set(weekLifts.map((h) => h.upperFocus));
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekMiles = runs
    .filter((r) => thisWeek(r.date))
    .reduce((s, r) => s + r.distanceM, 0);
  const lastMonday = addDays(monday, -7);
  const older = runs.filter((r) => r.date >= lastMonday && r.date < monday);

  // Chart data: the last 14 days (all the runs we have) and the last 8 calendar weeks of lifts.
  const milesDays: MilesDay[] = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13)).map((date) => {
    const d = dayType(date, runs, overrides, races);
    const lifts = history.filter((h) => h.date === date && h.session !== "none");
    const main = lifts.find((l) => !EASY_SESSIONS.includes(l.session)) ?? lifts[0];
    return {
      date,
      miles: d.runs.reduce((sum, r) => sum + r.distanceM, 0) / METERS_PER_MILE,
      type: d.type,
      runNames: d.runs.map((r) => r.name),
      lift: main
        ? { label: main.upperFocus ? UPPER_FOCUS_LABEL[main.upperFocus] : SESSION_LABEL[main.session], light: EASY_SESSIONS.includes(main.session) }
        : null,
    };
  });
  const thisMonday = mondayOf(today);
  const liftWeeks: LiftWeek[] = Array.from({ length: 8 }, (_, i) => addDays(thisMonday, (i - 7) * 7)).map((monday) => {
    const inWeek = history.filter((h) => h.date >= monday && h.date <= addDays(monday, 6));
    return { monday, strength: inWeek.filter((h) => h.hadStrength).length, plyo: inWeek.filter((h) => h.hadPlyo).length };
  });

  const [showOlder, setShowOlder] = useState(false);
  // The day whose run type is being changed (tap its tag).
  const [editing, setEditing] = useState<string | null>(null);
  const olderDays = Array.from({ length: 7 }, (_, i) => addDays(lastMonday, i));

  const dayRow = (date: string) => {
    const d = dayType(date, runs, overrides, races);
    const lifts = history.filter((h) => h.date === date);
    const recs = recovery.filter((r) => r.date === date);
    const isToday = date === today;
    const open = editing === date;
    return (
      <div key={date} className="flex gap-3 py-3">
        <div className="w-11 shrink-0 pt-0.5 text-center">
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-accent" : "text-muted"}`}>
            {isToday ? "Today" : weekday(date)}
          </p>
          <p className={`text-lg font-bold leading-tight tabular-nums ${isToday ? "text-accent" : ""}`}>{dayNum(date)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setEditing(open ? null : date)}
            aria-expanded={open}
            aria-label={`${RUN_TYPE_LABEL[d.type]} on ${formatDay(date)}. Change the kind of run`}
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_STYLE[d.type]} ${open ? "ring-2 ring-accent/40" : ""}`}
          >
            {RUN_TYPE_LABEL[d.type]}
            <svg viewBox="0 0 12 12" className="h-2.5 w-2.5 opacity-70" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d={open ? "M3 7.5 6 4.5l3 3" : "M3 4.5 6 7.5l3-3"} />
            </svg>
          </button>
          {open && (
            <div className="mt-2">
              <RunTypePicker
                value={d.type}
                className=""
                onPick={(t) => {
                  storage.setOverride(date, overrides[date] === t ? null : t);
                  setEditing(null);
                }}
              />
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
                {SOURCE_LABEL[d.source]}
                {d.source === "override" && (
                  <button
                    type="button"
                    className="font-semibold text-accent"
                    onClick={() => {
                      storage.setOverride(date, null);
                      setEditing(null);
                    }}
                  >
                    {d.runs.length ? "Use Strava's" : "Clear"}
                  </button>
                )}
              </p>
            </div>
          )}
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
            <p className="mt-0.5 text-xs text-muted">{date > today ? "Coming up" : "Nothing logged"}</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">This week</h1>
      <p className="mt-0.5 text-sm text-muted">
        {formatDay(monday)} – {formatDay(addDays(monday, 6))}
        {source === "mock" ? " · demo runs" : ""}
      </p>

      <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="lg:sticky lg:top-0">
      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Strength" value={`${counts.strength}/2`} full={counts.strength >= 2} />
        <Stat label="Plyo" value={`${counts.plyo}/2`} full={counts.plyo >= 2} />
        <Stat label="Miles" value={loading ? "…" : miles(weekMiles)} />
      </div>

      <Card className="mt-2 space-y-3 py-3.5">
        <CheckRow label="Plyo moves">
          {PLYO_FAMILIES.map((f) => (
            <Check key={f} done={plyoDone.has(f)} label={PLYO_FAMILY_LABEL[f]} />
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
      {/* Charts above the day-by-day list (phone: below the summary). */}
      <div className="mt-4 space-y-4">
        <MilesChart days={milesDays} />
        <LiftsChart weeks={liftWeeks} />
      </div>
      <SectionTitle>Day by day</SectionTitle>
      <Card className="divide-y divide-line py-0">{days.map(dayRow)}</Card>

      <button
        type="button"
        onClick={() => setShowOlder((v) => !v)}
        aria-expanded={showOlder}
        className="mt-4 min-h-11 w-full rounded-xl text-sm font-medium text-muted"
      >
        {showOlder ? "Hide last week" : `Show last week${older.length ? ` · ${older.length} runs` : ""}`}
      </button>
      {showOlder && <Card className="divide-y divide-line py-0">{olderDays.map(dayRow)}</Card>}
      </div>
      </div>
    </div>
  );
}

const SOURCE_LABEL: Record<DaySource, string> = {
  override: "Set by you.",
  "race-schedule": "From your race schedule.",
  strava: "From Strava.",
  none: "No run logged.",
};

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
