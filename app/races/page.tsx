"use client";

import { useState } from "react";
import { Button, Card, Chip, SectionTitle } from "@/components/ui";
import { addDays, dayInWeek, diffDays, formatDay, todayLocal, weekdayOf } from "@/lib/dates";
import { sampleRaces } from "@/lib/mock";
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

function Races() {
  const { races, profile } = useStore();
  const today = todayLocal();
  const [editing, setEditing] = useState<Race | null>(null);
  const upcoming = races.filter((r) => r.date >= today);
  const past = races.filter((r) => r.date < today).reverse();
  const next = upcoming[0];

  function save(race: Race) {
    const exists = races.some((r) => r.id === race.id);
    storage.saveRaces(exists ? races.map((r) => (r.id === race.id ? race : r)) : [...races, race]);
    setEditing(null);
  }

  function remove(id: string) {
    if (confirm("Delete this race?")) storage.saveRaces(races.filter((r) => r.id !== id));
    setEditing(null);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Races</h1>

      {next ? (
        <Card className="mt-4 bg-accent-soft">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Next race</p>
          <p className="mt-1 text-lg font-semibold">{next.name}</p>
          <p className="text-sm text-muted">
            {formatDay(next.date)} · {next.distance} · priority {next.priority}
          </p>
          <p className="mt-2 text-3xl font-bold text-accent">
            {diffDays(today, next.date) === 0 ? "Today" : `${diffDays(today, next.date)} days`}
          </p>
        </Card>
      ) : (
        <Card className="mt-4 space-y-3">
          <p className="text-sm text-muted">No upcoming races yet.</p>
          <Button onClick={() => storage.saveRaces([...races, ...sampleRaces(today)])}>Add a sample season</Button>
        </Card>
      )}

      {editing ? (
        <RaceForm race={editing} onSave={save} onCancel={() => setEditing(null)} onDelete={remove} isNew={!races.some((r) => r.id === editing.id)} />
      ) : (
        <Button
          variant="primary"
          className="mt-4 w-full"
          onClick={() => setEditing({ id: newId(), date: nextMeetDay(today, profile?.raceDay ?? "thu"), name: "", distance: "5K", priority: "B" })}
        >
          Add race
        </Button>
      )}

      {upcoming.length > 0 && <SectionTitle>Upcoming</SectionTitle>}
      <RaceList races={upcoming} onEdit={setEditing} today={today} />
      {past.length > 0 && <SectionTitle>Past</SectionTitle>}
      <RaceList races={past} onEdit={setEditing} today={today} />
    </div>
  );
}

function RaceList({ races, onEdit, today }: { races: Race[]; onEdit: (r: Race) => void; today: string }) {
  return (
    <ul className="space-y-2">
      {races.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => onEdit(r)} className="w-full text-left">
            <Card className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{r.name || "Untitled race"}</p>
                <p className="text-xs text-muted">
                  {formatDay(r.date)} · {r.distance}
                  {r.date >= today ? ` · in ${diffDays(today, r.date)}d` : ""}
                  {weekdayOf(r.date) !== "thu" ? " · not Thursday" : ""}
                </p>
              </div>
              <span className="rounded-full bg-card-2 px-2.5 py-1 text-xs font-bold">{r.priority}</span>
            </Card>
          </button>
        </li>
      ))}
    </ul>
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
    <Card className="mt-4 space-y-3">
      <h2 className="font-semibold">{isNew ? "New race" : "Edit race"}</h2>
      <label className="block text-sm">
        Date
        <input type="date" className={input} value={r.date} onChange={(e) => setR({ ...r, date: e.target.value })} />
      </label>
      <label className="block text-sm">
        Name
        <input className={input} placeholder="League meet" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })} />
      </label>
      <label className="block text-sm">
        Distance
        <input className={input} placeholder="5K" value={r.distance} onChange={(e) => setR({ ...r, distance: e.target.value })} />
      </label>
      <div className="text-sm">
        Priority
        <div className="mt-1 flex gap-2">
          {(["A", "B", "C"] as RacePriority[]).map((p) => (
            <Chip key={p} active={r.priority === p} onClick={() => setR({ ...r, priority: p })}>
              {p}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <Button variant="primary" className="flex-1" disabled={!r.date || !r.name.trim()} onClick={() => onSave({ ...r, name: r.name.trim() })}>
          Save
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
        {!isNew && (
          <Button className="text-warn" onClick={() => onDelete(r.id)}>
            Delete
          </Button>
        )}
      </div>
    </Card>
  );
}
