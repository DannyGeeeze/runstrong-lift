"use client";

import { useState } from "react";
import { LiftsBeforeRaces, SeasonMap } from "@/components/RaceCharts";
import { Button, Card, SectionTitle } from "@/components/ui";
import { addDays, dayInWeek, diffDays, formatDay, todayLocal } from "@/lib/dates";
import { isSampleRace, sampleRaces } from "@/lib/mock";
import { newId, storage } from "@/lib/storage";
import { useHydrated, useStore } from "@/lib/useStore";
import type { Race, RacePriority, Weekday } from "@/lib/types";

export default function RacesPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <Races />;
}

/** New races default to the next meet day from onboarding (Thursday unless you said otherwise). */
function nextMeetDay(today: string, day: Weekday) {
  const d = dayInWeek(today, day);
  return d < today ? addDays(d, 7) : d;
}

const PRIORITY: Record<RacePriority, { label: string; hint: string }> = {
  A: { label: "Goal race", hint: "Your big one. The app suggests Championship phase 3 weeks out, and easy days switch to a touch-up the week before." },
  B: { label: "Key race", hint: "An important race. No sauna in the 2 days before it." },
  C: { label: "Meet", hint: "A regular meet." },
};

const PRIORITY_STYLE: Record<RacePriority, string> = {
  A: "bg-accent text-accent-ink",
  B: "bg-accent-soft text-accent",
  C: "bg-card-2 text-muted",
};

function countdown(days: number) {
  return days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days`;
}

function Races() {
  const { races, profile, history, settings } = useStore();
  const today = todayLocal();
  const [editing, setEditing] = useState<Race | null>(null);
  const [showPast, setShowPast] = useState(false);
  const sorted = [...races].sort((a, b) => a.date.localeCompare(b.date));
  const upcoming = sorted.filter((r) => r.date >= today);
  const past = sorted.filter((r) => r.date < today).reverse();
  const [next, ...later] = upcoming;
  const isNew = editing !== null && !races.some((r) => r.id === editing.id);

  function save(race: Race) {
    const exists = races.some((r) => r.id === race.id);
    // Saving a sample race makes it yours: no Sample tag, and "Remove sample races" leaves it alone.
    const kept: Race = isSampleRace(race) ? { ...race, id: newId(), sample: undefined } : race;
    storage.saveRaces(exists ? races.map((r) => (r.id === race.id ? kept : r)) : [...races, kept]);
    setEditing(null);
  }

  const samples = races.filter(isSampleRace);
  function removeSamples() {
    if (confirm(`Remove ${samples.length} sample race${samples.length === 1 ? "" : "s"}? Your own races stay.`)) {
      storage.saveRaces(races.filter((r) => !isSampleRace(r)));
    }
  }

  function remove(id: string) {
    if (confirm("Delete this race?")) storage.saveRaces(races.filter((r) => r.id !== id));
    setEditing(null);
  }

  const form = (race: Race) => (
    <RaceForm key={race.id} race={race} onSave={save} onCancel={() => setEditing(null)} onDelete={remove} isNew={isNew} />
  );
  const list = (rs: Race[]) => (
    <Card className="divide-y divide-line py-0">
      {rs.map((r) =>
        editing?.id === r.id ? (
          <div key={r.id} className="py-3">
            {form(editing)}
          </div>
        ) : (
          <RaceRow key={r.id} race={r} today={today} onEdit={() => setEditing(r)} />
        ),
      )}
    </Card>
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Races</h1>
        {!isNew && (
          <Button
            variant="primary"
            className="min-h-10 px-4 py-2"
            onClick={() => setEditing({ id: newId(), date: nextMeetDay(today, profile?.raceDay ?? "thu"), name: "", priority: "B" })}
          >
            + Add race
          </Button>
        )}
      </div>

      {samples.length > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-warn-soft px-3 py-2.5 text-sm text-warn">
          <span>
            {samples.length} sample race{samples.length === 1 ? " is" : "s are"} on your schedule and count{samples.length === 1 ? "s" : ""} like real ones.
          </span>
          <button type="button" className="shrink-0 font-semibold underline" onClick={removeSamples}>
            Remove sample races
          </button>
        </div>
      )}

      {/* Desktop: the season at a glance. */}
      <div className="mt-6 hidden gap-6 lg:grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <SeasonMap races={races} today={today} phase={settings.phase} />
        <LiftsBeforeRaces races={races} history={history} today={today} />
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start lg:gap-8">
      <div className="min-w-0 lg:sticky lg:top-0">
      {isNew && editing && <Card className="mt-4">{form(editing)}</Card>}

      {next && editing?.id !== next.id ? (
        <button type="button" onClick={() => setEditing(next)} className="mt-4 block w-full text-left">
          <section className="rounded-3xl border border-line bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider text-accent">Next race</p>
              <span className="flex items-center gap-1.5">
                {isSampleRace(next) && <SampleTag />}
                <PriorityTag priority={next.priority} />
              </span>
            </div>
            <p className="mt-2 text-4xl font-bold tracking-tight text-accent">{countdown(diffDays(today, next.date))}</p>
            <p className="mt-2 text-lg font-semibold leading-tight">{next.name}</p>
            <p className="text-sm text-muted">
              {formatDay(next.date)}
              {next.distance ? ` · ${next.distance}` : ""}
            </p>
          </section>
        </button>
      ) : next ? (
        <Card className="mt-4">{form(editing!)}</Card>
      ) : (
        !editing && (
          <Card className="mt-4 space-y-3 text-center">
            <p className="text-sm text-muted">No upcoming races yet. Add your meets so lifting can plan around them.</p>
            <Button onClick={() => storage.saveRaces([...races, ...sampleRaces(today)])}>Add a sample season</Button>
          </Card>
        )
      )}

      </div>

      <div className="min-w-0">
      {later.length > 0 && (
        <>
          <SectionTitle>Coming up</SectionTitle>
          {list(later)}
        </>
      )}

      {past.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="mt-4 min-h-11 w-full rounded-xl text-sm font-medium text-muted"
          >
            {showPast ? "Hide past races" : `Show past races · ${past.length}`}
          </button>
          {showPast && list(past)}
        </>
      )}
      </div>
      </div>
    </div>
  );
}

function SampleTag() {
  return <span className="shrink-0 rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn">Sample</span>;
}

function PriorityTag({ priority }: { priority: RacePriority }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${PRIORITY_STYLE[priority]}`}>
      {PRIORITY[priority].label}
    </span>
  );
}

function RaceRow({ race: r, today, onEdit }: { race: Race; today: string; onEdit: () => void }) {
  const days = diffDays(today, r.date);
  return (
    <button type="button" onClick={onEdit} className="flex w-full items-center gap-3 py-3 text-left">
      <div className="w-11 shrink-0 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{formatDay(r.date).split(" ")[1]}</p>
        <p className="text-lg font-bold leading-tight tabular-nums">{Number(r.date.slice(8, 10))}</p>
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{r.name || "Untitled race"}</span>
          {isSampleRace(r) && <SampleTag />}
        </p>
        <p className="text-xs text-muted">
          {formatDay(r.date).split(",")[0]}
          {r.distance ? ` · ${r.distance}` : ""}
          {days >= 0 ? ` · ${countdown(days).toLowerCase()}` : ""}
        </p>
      </div>
      <PriorityTag priority={r.priority} />
    </button>
  );
}

function RaceForm({
  race,
  isNew,
  onSave,
  onCancel,
  onDelete,
}: {
  race: Race;
  isNew: boolean;
  onSave: (r: Race) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const [r, setR] = useState(race);
  const input = "mt-1 w-full rounded-xl border border-line bg-card-2 px-3 py-2.5 text-base";
  return (
    <div className="space-y-3">
      <h2 className="font-semibold">{isNew ? "New race" : "Edit race"}</h2>
      {isSampleRace(race) && <p className="text-xs text-muted">This is a sample race. Saving it makes it one of your own.</p>}
      <label className="block text-sm font-medium">
        Name
        <input className={input} placeholder="League meet" value={r.name} autoFocus={isNew} onChange={(e) => setR({ ...r, name: e.target.value })} />
      </label>
      <label className="block text-sm font-medium">
        Date
        <input type="date" className={input} value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} />
      </label>
      <div className="text-sm font-medium">
        How big is it?
        <div className="mt-1 grid grid-cols-3 gap-1 rounded-xl bg-card-2 p-1">
          {(["A", "B", "C"] as RacePriority[]).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={r.priority === p}
              onClick={() => setR({ ...r, priority: p })}
              className={`min-h-10 rounded-lg px-1 text-sm font-semibold transition-colors ${
                r.priority === p ? "bg-card text-ink shadow-sm ring-1 ring-line" : "text-muted"
              }`}
            >
              {PRIORITY[p].label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs font-normal text-muted">{PRIORITY[r.priority].hint}</p>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="primary" className="flex-1" disabled={!r.date || !r.name.trim()} onClick={() => onSave({ ...r, name: r.name.trim() })}>
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </div>
      {!isNew && (
        <button type="button" className="min-h-10 w-full text-sm font-medium text-warn" onClick={() => onDelete(r.id)}>
          Delete race
        </button>
      )}
    </div>
  );
}
