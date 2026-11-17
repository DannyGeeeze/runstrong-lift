"use client";

import { useSyncExternalStore } from "react";
import { activeKey, storage, type AppData } from "./storage";

let cache: { raw: string | null; data: AppData } | null = null;
const SERVER = storage.load(); // window is undefined on the server → defaults

function snapshot(): AppData {
  let raw: string | null = null;
  const key = activeKey();
  try {
    raw = key + "|" + window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (!cache || cache.raw !== raw) cache = { raw, data: storage.load() };
  return cache.data;
}

function subscribe(cb: () => void) {
  window.addEventListener("runstrong-storage", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("runstrong-storage", cb);
    window.removeEventListener("storage", cb);
  };
}

/** Reactive view of everything in storage. Write through `storage.*`. */
export function useStore(): AppData {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

/** True after hydration (so client-only values like "today" don't mismatch). */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
