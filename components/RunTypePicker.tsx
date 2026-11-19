"use client";

import { RUN_TYPE_LABEL } from "@/lib/day";
import type { RunType } from "@/lib/types";

export const RUN_TYPES: RunType[] = ["easy", "long", "workout", "race", "rest"];

/** The five run types as one row of equal buttons (no wrapping). */
export function RunTypePicker({ value, onPick, className = "mt-3" }: { value: RunType; onPick: (t: RunType) => void; className?: string }) {
  return (
    <div className={`grid grid-cols-5 gap-1 rounded-xl bg-card-2 p-1 ${className}`} role="group" aria-label="Kind of run">
      {RUN_TYPES.map((t) => (
        <button
          key={t}
          type="button"
          aria-pressed={value === t}
          onClick={() => onPick(t)}
          className={`min-h-10 rounded-lg px-0.5 text-[13px] font-semibold transition-colors ${
            value === t ? "bg-accent text-accent-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {RUN_TYPE_LABEL[t]}
        </button>
      ))}
    </div>
  );
}
