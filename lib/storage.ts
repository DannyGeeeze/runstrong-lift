// The ONE storage module. Everything the app persists goes through here, so swapping
// localStorage for a database later means rewriting only this file.

import type { BlockPicks, LiftLog, Race, RunType, Settings } from "./types";

export const DEFAULT_SETTINGS: Settings = {
  phase: "early",
  tuneUpDay: "tue",
  workoutDays: ["tue", "fri"],
  deepRaceDay: "half",
  returnWeek: false,
  enablePower: false,
  enableMobility: false,
  mockMode: false,
};

export interface AppData {
  version: 1;
  settings: Settings;
  races: Race[];
  history: LiftLog[];
  block: BlockPicks | null;
  /** Manual run-type overrides keyed by date. */
  overrides: Record<string, RunType>;
}

const KEY = "runstrong-lift:v1";

function empty(): AppData {
  return { version: 1, settings: DEFAULT_SETTINGS, races: [], history: [], block: null, overrides: {} };
}

function read(): AppData {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    return normalize(JSON.parse(raw));
  } catch {
    return empty();
  }
}

function write(data: AppData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
    window.dispatchEvent(new Event("runstrong-storage"));
  } catch {
    // Storage full or blocked: nothing else we can do in a local-only app.
  }
}

function normalize(input: Partial<AppData>): AppData {
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) },
    races: Array.isArray(input.races) ? input.races : [],
    history: Array.isArray(input.history) ? input.history : [],
    block: input.block ?? null,
    overrides: input.overrides ?? {},
  };
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
