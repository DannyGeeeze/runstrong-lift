// Bridge to the iPhone app's lock-screen Live Activity (ios/App/App/LiveActivityPlugin.swift).
// In a normal browser every call here does nothing, so the website behaves as before.

import { Capacitor, registerPlugin } from "@capacitor/core";

export interface ActivityState {
  phase: "work" | "hold" | "countdown" | "rest" | "paused" | "done";
  title: string;
  detail: string;
  /** Big text when there's no timer, e.g. "3-5". */
  big?: string;
  /** Epoch ms when the current countdown ends; the lock screen counts down by itself. */
  endsAt?: number;
  /** Seconds left while paused. */
  pausedLeft?: number;
  progress: number;
  next?: string;
}

interface LiveActivityPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  start(options: ActivityState & { workoutTitle: string }): Promise<{ id: string }>;
  update(options: ActivityState): Promise<void>;
  end(options: Partial<ActivityState> & { finished?: boolean }): Promise<void>;
}

const Plugin = registerPlugin<LiveActivityPlugin>("LiveActivity");

const inApp = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

// Calls are queued so start always lands before the first update.
let chain: Promise<unknown> = Promise.resolve();
function queue(fn: () => Promise<unknown>) {
  if (!inApp()) return;
  chain = chain.then(fn).catch(() => undefined);
}

export const liveActivity = {
  start: (workoutTitle: string, state: ActivityState) => queue(() => Plugin.start({ ...state, workoutTitle })),
  update: (state: ActivityState) => queue(() => Plugin.update(state)),
  end: (state?: Partial<ActivityState>, finished = false) => queue(() => Plugin.end({ ...(state ?? {}), finished })),
};
