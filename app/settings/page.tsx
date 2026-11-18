"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { EQUIPMENT_OPTIONS, EVENT_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS, SPOT_OPTIONS } from "@/lib/profile";
import { Button, Card, Chip, Notice, SectionTitle, Toggle } from "@/components/ui";
import { formatDay, todayLocal } from "@/lib/dates";
import { blockEnds, PHASE_LABEL, suggestPhase } from "@/lib/rules";
import { storage } from "@/lib/storage";
import { trackSeasonScenario } from "@/lib/mock";
import { useHydrated, useStore } from "@/lib/useStore";
import { useRuns } from "@/lib/useRuns";
import type { Phase, Settings, Weekday } from "@/lib/types";

const PHASES: Phase[] = ["off", "early", "deep", "championship"];
const DAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const STRAVA_ERRORS: Record<string, string> = {
  denied: "Strava access was cancelled.",
  state: "The Strava sign-in expired. Try again.",
  scope: "Please allow \"View data about your private activities\" so the app can read all your runs.",
  token: "Couldn't finish connecting to Strava. Check the client ID and secret.",
  nocode: "Strava didn't return a code. Try again.",
};

export default function SettingsPage() {
  const hydrated = useHydrated();
  if (!hydrated) return <p className="pt-10 text-center text-muted">Loading…</p>;
  return <SettingsView />;
}

function SettingsView() {
  const data = useStore();
  const { settings, races, block, profile } = data;
  const { status, reload } = useRuns(settings.mockMode);
  const today = todayLocal();
  const suggestion = suggestPhase(races, today);
  const [stravaError, setStravaError] = useState<string | null>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("strava");
    if (code) setStravaError(STRAVA_ERRORS[code] ?? "Couldn't connect to Strava.");
  }, []);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => storage.saveSettings({ ...settings, [key]: value });

  async function disconnect() {
    await fetch("/api/strava/logout", { method: "POST" });
    reload();
  }

  function exportData() {
    const blob = new Blob([storage.exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runstrong-lift-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    try {
      storage.importJson(await file.text());
      setImportMsg({ ok: true, text: "Imported." });
    } catch {
      setImportMsg({ ok: false, text: "That file isn't a RunStrong Lift export." });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <SectionTitle right={<Link href="/welcome" className="text-xs font-semibold text-accent">Redo setup</Link>}>
        Your profile
      </SectionTitle>
      <Card>
        {profile ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Event</dt>
            <dd>{EVENT_OPTIONS.filter((o) => profile.events.includes(o.value)).map((o) => o.label).join(", ")} · {profile.weeklyMiles} mi/wk</dd>
            <dt className="text-muted">Lifting</dt>
            <dd>{EXPERIENCE_OPTIONS.find((o) => o.value === profile.experience)?.label}</dd>
            <dt className="text-muted">Gear</dt>
            <dd>{EQUIPMENT_OPTIONS.find((o) => o.value === profile.equipment)?.label}</dd>
            <dt className="text-muted">Goals</dt>
            <dd>{GOAL_OPTIONS.filter((g) => profile.goals.includes(g.value)).map((g) => g.label).join(", ") || "None"}</dd>
            <dt className="text-muted">Focus</dt>
            <dd>{SPOT_OPTIONS.filter((s) => profile.troubleSpots.includes(s.value)).map((s) => s.label).join(", ") || "Nothing cranky"}</dd>
            <dt className="text-muted">Sessions</dt>
            <dd>{profile.sessionMinutes} min</dd>
          </dl>
        ) : (
          <Link href="/welcome" className="text-sm font-semibold text-accent">Set up your profile</Link>
        )}
      </Card>

      <SectionTitle>Season phase</SectionTitle>
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {PHASES.map((p) => (
            <Chip key={p} active={settings.phase === p} onClick={() => set("phase", p)}>
              {PHASE_LABEL[p]}
            </Chip>
          ))}
        </div>
        <p className="text-sm text-muted">
          Suggested: <span className="font-semibold text-ink">{PHASE_LABEL[suggestion.phase]}</span>
          {suggestion.phase !== settings.phase && (
            <button type="button" className="ml-1 font-semibold text-accent" onClick={() => set("phase", suggestion.phase)}>
              Use it
            </button>
          )}
        </p>
      </Card>

      <SectionTitle>Race week</SectionTitle>
      <Card className="space-y-4">
        <div>
          <p className="text-sm font-medium">Tune-up workout before a Thursday race</p>
          <div className="mt-2 flex gap-2">
            <Chip active={settings.tuneUpDay === "mon"} onClick={() => set("tuneUpDay", "mon")}>Monday</Chip>
            <Chip active={settings.tuneUpDay === "tue"} onClick={() => set("tuneUpDay", "tue")}>Tuesday</Chip>
          </div>
        </div>
        <div>
          <p className="text-sm font-medium">Workout days in weeks with no race</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <Chip
                key={d}
                active={settings.workoutDays.includes(d)}
                onClick={() =>
                  set(
                    "workoutDays",
                    settings.workoutDays.includes(d) ? settings.workoutDays.filter((x) => x !== d) : [...settings.workoutDays, d],
                  )
                }
              >
                {d[0].toUpperCase() + d.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      <SectionTitle>Sessions</SectionTitle>
      <Card className="divide-y divide-line py-1">
        <Toggle checked={settings.returnWeek} onChange={(v) => set("returnWeek", v)} label="Return week (after a break)" />
        <Toggle checked={settings.enablePower} onChange={(v) => set("enablePower", v)} label="Power moves" />
        <Toggle checked={settings.enableMobility} onChange={(v) => set("enableMobility", v)} label="Mobility moves" />
      </Card>

      <SectionTitle>Recovery</SectionTitle>
      <Card className="divide-y divide-line py-1">
        <Toggle checked={settings.hasBoots} onChange={(v) => set("hasBoots", v)} label="I have compression boots" />
        <Toggle checked={settings.hasSauna} onChange={(v) => set("hasSauna", v)} label="I have a sauna" />
      </Card>

      <SectionTitle>Exercise block</SectionTitle>
      <Card className="space-y-3">
        {block ? (
          <p className="text-sm text-muted">
            Rotates {formatDay(blockEnds(block))}
          </p>
        ) : (
          <p className="text-sm text-muted">Starts with your first session</p>
        )}
        {block && (
          <Button onClick={() => confirm("Start a new block with fresh picks?") && storage.saveBlock(null)}>Start new block now</Button>
        )}
      </Card>

      <SectionTitle>Strava</SectionTitle>
      <Card className="space-y-3">
        {stravaError && <Notice tone="warn">{stravaError}</Notice>}
        {!status ? (
          <p className="text-sm text-muted">Checking…</p>
        ) : !status.configured ? (
          <p className="text-sm text-muted">Not set up</p>
        ) : status.connected ? (
          <div className="flex items-center justify-between">
            <p className="text-sm">Connected{status.athlete ? ` as ${status.athlete}` : ""}.</p>
            <Button onClick={disconnect}>Disconnect</Button>
          </div>
        ) : (
          <a href="/api/strava/login" className="inline-flex min-h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">
            Connect Strava
          </a>
        )}
        <Toggle checked={settings.mockMode} onChange={(v) => set("mockMode", v)} label="Demo runs" />
      </Card>

      <SectionTitle>Test mode</SectionTitle>
      <Card className="flex items-center justify-between">
        <span className="text-sm font-medium">{data.testMode ? "Mid track season (on)" : "Mid track season"}</span>
        {data.testMode ? (
          <Button onClick={() => storage.exitTestMode()}>Exit</Button>
        ) : (
          <Button onClick={() => storage.enterTestMode(trackSeasonScenario(today, data))}>Try it</Button>
        )}
      </Card>

      <SectionTitle>Your data</SectionTitle>
      <Card className="space-y-3">
        <div className="flex gap-2">
          <Button onClick={exportData}>Export JSON</Button>
          <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f && confirm("Importing replaces everything stored on this device. Continue?")) importData(f);
              e.target.value = "";
            }}
          />
        </div>
        {importMsg && <Notice tone={importMsg.ok ? "good" : "warn"}>{importMsg.text}</Notice>}
      </Card>
    </div>
  );
}
