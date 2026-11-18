"use client";

import { duration, miles, pacePerMile } from "@/lib/strava";
import type { Run } from "@/lib/types";

/** One run: its name, then distance · time · pace · heart rate on one line. */
export function RunRow({ run, compact = false }: { run: Run; compact?: boolean }) {
  return (
    <div className={compact ? "py-0.5" : "py-2"}>
      <p className="truncate text-sm font-medium">{run.name}</p>
      <p className="truncate text-xs tabular-nums text-muted">
        {miles(run.distanceM)} mi · {pacePerMile(run.distanceM, run.movingTimeS)}
        {!compact && ` · ${duration(run.movingTimeS)}`}
        {run.avgHr ? ` · ${run.avgHr} bpm` : ""}
      </p>
    </div>
  );
}
