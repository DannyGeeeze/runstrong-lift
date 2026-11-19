"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { EQUIPMENT_OPTIONS, EVENT_OPTIONS, EXPERIENCE_OPTIONS, GOAL_OPTIONS, SPOT_OPTIONS } from "@/lib/profile";
import { Button, Card, Notice, SectionTitle, Toggle } from "@/components/ui";
import { addDays, diffDays, formatDay, todayLocal } from "@/lib/dates";
import { blockEnds, BREAK_STAGE_LABEL, PHASE_HINT, PHASE_LABEL, suggestBreakStage, suggestPhase, VOLUME_MILES, volumeTier, weeklyMilesFor } from "@/lib/rules";
import { wantsPlyoEmphasis, wantsTendonEmphasis } from "@/lib/profile";
import { METERS_PER_MILE } from "@/lib/strava";
import { storage } from "@/lib/storage";
import { trackSeasonScenario } from "@/lib/mock";
import { useHydrated, useStore } from "@/lib/useStore";
import { useRuns } from "@/lib/useRuns";
import type { BreakStage, Phase, Run, Settings, Weekday } from "@/lib/types";

/** Plain-language: how big Full sessions are right now, and why. */
function volumeLine(runs: Run[], today: string, profileMiles: number): string {
  const last7 = runs.filter((r) => r.date > addDays(today, -7) && r.date <= today);
  const wm = weeklyMilesFor(last7.reduce((sum, r) => sum + r.distanceM, 0) / METERS_PER_MILE, last7.length, profileMiles);
  if (!wm) return "";
  const m = Math.round(wm.miles);
  const from = wm.source === "runs" ? `${m} mi in the last 7 days` : `${m} mi/week (your setup answer)`;
  const tier = volumeTier(wm.miles);
  return tier === "full"
    ? `${from}: full sessions. Session size grows with mileage and never drops at your peak.`
    : `${from}: ${tier === "base" ? "lighter" : "building"} sessions. They grow to full at ${VOLUME_MILES.full} mi/week.`;
}

const PHASES: Phase[] = ["off", "early", "deep", "championship"];
const BREAK_STAGES: BreakStage[] = ["off", "ramp", "normal"];
const BREAK_HINT: Record<BreakStage, string> = {
  off: "No hard runs. An optional 15-min session of easy holds every 2-3 days, on any day.",
  ramp: "The week after: Full sessions at lighter loads (2-3 x 8-12 @ RPE 5-6), easier plyos. Normal 48h rules.",
  normal: "Regular training rules.",
};
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
  const { status, reload, runs } = useRuns(settings.mockMode);
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
  /** Picking a stage starts its 7-day count today; Normal clears it. */
  const setStage = (stage: BreakStage) =>
    storage.saveSettings({ ...settings, breakStage: stage, breakStageSince: stage === "normal" ? "" : today });
  const breakNext = suggestBreakStage(settings, today);

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

  const stravaLine = !status
    ? "Checking…"
    : !status.configured
      ? "Not set up"
      : status.connected
        ? `Connected${status.athlete ? ` as ${status.athlete}` : ""}`
        : "Not connected";

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Settings</h1>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
      <div className="min-w-0">
      <SectionTitle right={<Link href="/welcome" className="text-xs font-semibold text-accent">Redo setup</Link>}>
        You
      </SectionTitle>
      <Card>
        {profile ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Event</dt>
            <dd>{EVENT_OPTIONS.filter((o) => profile.events.includes(o.value)).map((o) => o.label).join(", ")} · {profile.weeklyMiles} mi/wk</dd>
            <dt className="text-muted">Lifting</dt>
            <dd>{EXPERIENCE_OPTIONS.find((o) => o.value === profile.experience)?.label} · {EQUIPMENT_OPTIONS.find((o) => o.value === profile.equipment)?.label} · {profile.sessionMinutes} min</dd>
            <dt className="text-muted">Goals</dt>
            <dd>{GOAL_OPTIONS.filter((g) => profile.goals.includes(g.value)).map((g) => g.label).join(", ") || "None"}</dd>
            <dt className="text-muted">Focus</dt>
            <dd>{SPOT_OPTIONS.filter((s) => profile.troubleSpots.includes(s.value)).map((s) => s.label).join(", ") || "Nothing cranky"}</dd>
          </dl>
        ) : null}
        {profile ? (
          <p className="mt-3 border-t border-line pt-3 text-xs leading-relaxed text-muted">
            {volumeLine(runs, today, profile.weeklyMiles)}
            {wantsPlyoEmphasis(profile) && " Full sessions always get 2 plyos."}
            {wantsTendonEmphasis(profile) && " XC/road: the calf move favors Achilles holds."}
          </p>
        ) : (
          <Link href="/welcome" className="text-sm font-semibold text-accent">Set up your profile</Link>
        )}
      </Card>

      <SectionTitle>Training</SectionTitle>
      <Card className="divide-y divide-line py-0">
        <div className="py-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Season phase</p>
            {suggestion.phase !== settings.phase ? (
              <button type="button" className="text-xs font-semibold text-accent" onClick={() => set("phase", suggestion.phase)}>
                Suggested: {PHASE_LABEL[suggestion.phase]} · Use it
              </button>
            ) : (
              <span className="text-xs text-muted">Matches your races</span>
            )}
          </div>
          <Segmented
            cols={2}
            options={PHASES.map((p) => ({ value: p, label: PHASE_LABEL[p] }))}
            value={settings.phase}
            onChange={(p) => set("phase", p)}
          />
          <p className="mt-2 text-xs text-muted">{PHASE_HINT[settings.phase]}</p>
        </div>
        <div className="py-4">
          <p className="text-sm font-medium">Tune-up workout before a Thursday race</p>
          <Segmented
            cols={2}
            options={[
              { value: "mon", label: "Monday" },
              { value: "tue", label: "Tuesday" },
            ]}
            value={settings.tuneUpDay}
            onChange={(d) => set("tuneUpDay", d)}
          />
        </div>
        <div className="py-4">
          <p className="text-sm font-medium">Workout days in weeks with no race</p>
          <div className="mt-2 grid grid-cols-7 gap-1">
            {DAYS.map((d) => {
              const on = settings.workoutDays.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={d}
                  onClick={() => set("workoutDays", on ? settings.workoutDays.filter((x) => x !== d) : [...settings.workoutDays, d])}
                  className={`min-h-10 rounded-lg text-sm font-semibold transition-colors ${on ? "bg-accent text-accent-ink" : "bg-card-2 text-muted"}`}
                >
                  {d[0].toUpperCase() + d.slice(1, 2)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="py-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-medium">Break / return</p>
            {settings.breakStage !== "normal" && settings.breakStageSince && (
              <span className="text-xs text-muted">Day {Math.max(1, diffDays(settings.breakStageSince, today) + 1)}</span>
            )}
          </div>
          <Segmented
            cols={3}
            options={BREAK_STAGES.map((b) => ({ value: b, label: BREAK_STAGE_LABEL[b] }))}
            value={settings.breakStage}
            onChange={setStage}
          />
          <p className="mt-2 text-xs text-muted">{BREAK_HINT[settings.breakStage]}</p>
          {settings.breakStage !== "normal" && (
            <label className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
              Started on
              <input
                type="date"
                max={today}
                value={settings.breakStageSince}
                onChange={(e) => e.target.value && set("breakStageSince", e.target.value)}
                className="rounded-lg border border-line bg-card-2 px-2 py-1.5 text-sm text-ink"
              />
            </label>
          )}
          {breakNext && (
            <div className="mt-3 rounded-xl bg-accent-soft px-3 py-2.5 text-sm">
              <p>{breakNext.message}</p>
              <button type="button" className="mt-1 font-semibold text-accent" onClick={() => setStage(breakNext.next)}>
                Switch to {BREAK_STAGE_LABEL[breakNext.next]}
              </button>
            </div>
          )}
        </div>
        <div className="py-2">
          <Toggle
            checked={settings.enablePower}
            onChange={(v) => set("enablePower", v)}
            label="Power moves"
            hint="Adds an explosive move to full sessions."
          />
          <Toggle
            checked={settings.enableMobility}
            onChange={(v) => set("enableMobility", v)}
            label="Mobility moves"
            hint="Adds a mobility move to full sessions."
          />
        </div>
      </Card>

      </div>

      <div className="min-w-0">
      <SectionTitle>Recovery</SectionTitle>
      <Card className="py-2">
        <Toggle checked={settings.hasBoots} onChange={(v) => set("hasBoots", v)} label="Compression boots" hint="I have them" />
        <Toggle checked={settings.hasSauna} onChange={(v) => set("hasSauna", v)} label="Sauna" hint="I have access to one" />
      </Card>

      <SectionTitle>Runs</SectionTitle>
      <Card className="py-2">
        {stravaError && (
          <div className="py-2">
            <Notice tone="warn">{stravaError}</Notice>
          </div>
        )}
        <div className="flex min-h-12 items-center justify-between gap-3 py-2">
          <span>
            <span className="block text-sm font-medium">Strava</span>
            <span className="block text-xs text-muted">{stravaLine}</span>
          </span>
          {status?.configured &&
            (status.connected ? (
              <Button className="min-h-9 py-1.5" onClick={disconnect}>Disconnect</Button>
            ) : (
              <a href="/api/strava/login" className="inline-flex min-h-9 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">
                Connect
              </a>
            ))}
        </div>
        <Toggle checked={settings.mockMode} onChange={(v) => set("mockMode", v)} label="Demo runs" hint="Use sample runs instead of Strava." />
      </Card>

      <SectionTitle>More</SectionTitle>
      <Card className="divide-y divide-line py-0">
        <Row
          label="Exercise block"
          hint={
            block
              ? `Moves stay the same so you can progress. New picks on ${formatDay(blockEnds(block))}.`
              : "Moves stay the same for 4 weeks so you can progress."
          }
          action={
            block && (
              <button
                type="button"
                className="text-sm font-semibold text-accent"
                onClick={() => confirm("Start a new block with fresh picks?") && storage.saveBlock(null)}
              >
                New picks
              </button>
            )
          }
        />
        <Row
          label="Test mode"
          hint={data.testMode ? "On: mid track season. Your real data is safe." : "Try the app mid track season."}
          action={
            <button
              type="button"
              className="text-sm font-semibold text-accent"
              onClick={() => (data.testMode ? storage.exitTestMode() : storage.enterTestMode(trackSeasonScenario(today, data)))}
            >
              {data.testMode ? "Exit" : "Try it"}
            </button>
          }
        />
        <Row
          label="Backup"
          hint="Your data lives on this device."
          action={
            <div className="flex gap-3">
              <button type="button" className="text-sm font-semibold text-accent" onClick={exportData}>
                Export
              </button>
              <button type="button" className="text-sm font-semibold text-accent" onClick={() => fileRef.current?.click()}>
                Import
              </button>
            </div>
          }
        />
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
      </Card>
      {importMsg && (
        <div className="mt-2">
          <Notice tone={importMsg.ok ? "good" : "warn"}>{importMsg.text}</Notice>
        </div>
      )}
      </div>
      </div>
    </div>
  );
}


function Segmented<T extends string>({
  options,
  value,
  onChange,
  cols,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  cols: number;
}) {
  return (
    <div className={`mt-2 grid gap-1 rounded-xl bg-card-2 p-1 ${cols === 2 ? "grid-cols-2" : cols === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-lg px-1 text-sm font-semibold transition-colors ${
            value === o.value ? "bg-card text-ink shadow-sm ring-1 ring-line" : "text-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, action }: { label: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      {action && <span className="shrink-0">{action}</span>}
    </div>
  );
}
