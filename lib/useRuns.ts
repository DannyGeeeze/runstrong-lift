"use client";

import { useCallback, useEffect, useState } from "react";
import { todayLocal } from "./dates";
import { mockRuns } from "./mock";
import type { Run } from "./types";

export interface StravaStatus {
  configured: boolean;
  connected: boolean;
  athlete?: string;
}

export interface RunsState {
  runs: Run[];
  source: "mock" | "strava" | "none";
  status: StravaStatus | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Last 14 days of runs, from Strava when connected, otherwise mock data (if allowed). */
export function useRuns(mockMode: boolean): RunsState {
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [source, setSource] = useState<RunsState["source"]>("none");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      let st: StravaStatus = { configured: false, connected: false };
      try {
        const res = await fetch("/api/strava/status", { cache: "no-store" });
        if (res.ok) st = await res.json();
      } catch {
        // offline: fall through to mock
      }
      if (cancelled) return;
      setStatus(st);

      // Mock mode: when turned on, or when Strava isn't set up / connected yet.
      if (mockMode || !st.connected) {
        setRuns(mockMode || !st.configured ? mockRuns(todayLocal()) : []);
        setSource(mockMode || !st.configured ? "mock" : "none");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch("/api/strava/activities", { cache: "no-store" });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `Strava error ${res.status}`);
        if (!cancelled) {
          setRuns(body.runs);
          setSource("strava");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Couldn't load Strava activities");
          setRuns([]);
          setSource("none");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [mockMode, tick]);

  return { runs, source, status, loading, error, reload };
}
