// The ONE storage module. Everything the app persists goes through here, so swapping
// localStorage for a database later means rewriting only this file.

import { todayLocal } from "./dates";
import type { Profile } from "./profile";
import type { BlockPicks, LiftLog, Race, RecoveryLog, RunType, Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  phase: "early",
  tuneUpDay: "tue",
  workoutDays: ["tue", "fri"],
  deepRaceDay: "half",
  breakStage: "normal",
  breakStageSince: "",
  enablePower: false,
  enableMobility: false,
  mockMode: false,
  hasBoots: true,
  hasSauna: true,
};

export interface AppData {
  version: 1;
  settings: Settings;
  races: Race[];
  history: LiftLog[];
  /** Compression boots and sauna sessions. */
  recovery: RecoveryLog[];
  block: BlockPicks | null;
  /** Manual run-type overrides keyed by date. */
  overrides: Record<string, RunType>;
  /** Onboarding answers; null until onboarding is finished. */
  profile: Profile | null;
  /** True while a test scenario is loaded (read-only flag, set by the storage mode). */
  testMode: boolean;
}

const KEY = "runstrong-lift:v1";
/** Test scenarios live in their own slot so real data is never touched. */
const TEST_KEY = "runstrong-lift:test";
const MODE_KEY = "runstrong-lift:mode";

function inTestMode(): boolean {
  try {
    return window.localStorage.getItem(MODE_KEY) === "test";
  } catch {
    return false;
  }
}

/** The localStorage key currently in use. */
export function activeKey(): string {
  return typeof window !== "undefined" && inTestMode() ? TEST_KEY : KEY;
}

function empty(): AppData {
  return { version: 1, settings: DEFAULT_SETTINGS, races: [], history: [], recovery: [], block: null, overrides: {}, profile: null, testMode: false };
}

function read(): AppData {
  if (typeof window === "undefined") return empty();
  const testMode = inTestMode();
  try {
    const raw = window.localStorage.getItem(activeKey());
    if (!raw) return { ...empty(), testMode };
    return { ...normalize(JSON.parse(raw)), testMode };
  } catch {
    return { ...empty(), testMode };
  }
}

function notify() {
  window.dispatchEvent(new Event("runstrong-storage"));
}

function write(data: AppData) {
  if (typeof window === "undefined") return;
  try {
    const { testMode: _t, ...rest } = data;
    void _t;
    window.localStorage.setItem(activeKey(), JSON.stringify(rest));
    notify();
  } catch {
    // Storage full or blocked: nothing else we can do in a local-only app.
  }
}

function normalize(input: Partial<AppData>): AppData {
  return {
    version: 1,
    settings: normalizeSettings(input.settings),
    races: Array.isArray(input.races) ? input.races : [],
    history: Array.isArray(input.history) ? input.history : [],
    recovery: Array.isArray(input.recovery) ? input.recovery : [],
    block: input.block ?? null,
    overrides: input.overrides ?? {},
    profile: normalizeProfile(input.profile),
    testMode: false,
  };
}

/** The old "Return week" on/off became the Week off stage, starting the day it's first loaded. */
export function normalizeSettings(raw: unknown): Settings {
  const old = (raw && typeof raw === "object" ? raw : {}) as Partial<Settings> & { returnWeek?: boolean };
  const { returnWeek, ...rest } = old;
  const settings: Settings = { ...DEFAULT_SETTINGS, ...rest };
  // Look at what was saved, not the merged defaults: older data has no stage at all.
  if (!["off", "ramp", "normal"].includes(old.breakStage as string)) {
    settings.breakStage = returnWeek ? "off" : "normal";
    settings.breakStageSince = returnWeek ? todayLocal() : "";
  }
  if (typeof settings.breakStageSince !== "string") settings.breakStageSince = "";
  return settings;
}

/** Older profiles stored a single `event`; they now hold a list. */
function normalizeProfile(p: unknown): Profile | null {
  if (!p || typeof p !== "object") return null;
  const old = p as Profile & { event?: Profile["events"][number] };
  const events = Array.isArray(old.events) && old.events.length ? old.events : old.event ? [old.event] : ["xc" as const];
  const { event: _drop, ...rest } = old;
  void _drop;
  return { ...rest, events };
}

function update(fn: (d: AppData) => AppData) {
  write(fn(read()));
}

export const storage = {
  load: read,

  saveSettings(settings: Settings) {
    update((d) => ({ ...d, settings }));
  },

  saveRaces(races: Race[]) {
    update((d) => ({ ...d, races: [...races].sort((a, b) => a.date.localeCompare(b.date)) }));
  },

  addLift(log: LiftLog) {
    update((d) => ({ ...d, history: [...d.history, log] }));
  },

  deleteLift(id: string) {
    update((d) => ({ ...d, history: d.history.filter((h) => h.id !== id) }));
  },

  addRecovery(log: RecoveryLog) {
    update((d) => ({ ...d, recovery: [...d.recovery, log] }));
  },

  deleteRecovery(id: string) {
    update((d) => ({ ...d, recovery: d.recovery.filter((r) => r.id !== id) }));
  },

  saveProfile(profile: Profile | null) {
    update((d) => ({ ...d, profile }));
  },

  saveBlock(block: BlockPicks | null) {
    update((d) => ({ ...d, block }));
  },

  setOverride(date: string, type: RunType | null) {
    update((d) => {
      const overrides = { ...d.overrides };
      if (type) overrides[date] = type;
      else delete overrides[date];
      return { ...d, overrides };
    });
  },

  /** Switch to a throwaway copy of the data (e.g. a mid-season scenario). */
  enterTestMode(scenario: AppData) {
    try {
      window.localStorage.setItem(MODE_KEY, "test");
    } catch {
      return;
    }
    write(scenario);
  },

  /** Back to real data; the test copy is discarded. */
  exitTestMode() {
    try {
      window.localStorage.removeItem(MODE_KEY);
      window.localStorage.removeItem(TEST_KEY);
    } catch {
      // ignore
    }
    notify();
  },

  exportJson(): string {
    return JSON.stringify(read(), null, 2);
  },

  /** Throws on invalid JSON. Replaces all stored data. */
  importJson(json: string) {
    const parsed = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) throw new Error("Not a RunStrong Lift export");
    write(normalize(parsed));
  },

  reset() {
    write(empty());
  },
};

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
