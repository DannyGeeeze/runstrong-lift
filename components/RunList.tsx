"use client";

import { RUN_TYPE_LABEL } from "@/lib/day";
import { duration, miles, pacePerMile, STRAVA_TYPE_LABEL } from "@/lib/strava";
import type { Run } from "@/lib/types";

export function RunRow({ run }: { run: Run }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{run.name}</p>
        <p className="font-mono text-xs text-muted">
          {miles(run.distanceM)} mi · {duration(run.movingTimeS)} · {pacePerMile(run.distanceM, run.movingTimeS)}
          {run.avgHr ? ` · ${run.avgHr} bpm` : ""}
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-card-2 px-2 py-0.5 text-xs text-muted">
        {run.stravaWorkoutType != null ? STRAVA_TYPE_LABEL[run.stravaWorkoutType] ?? RUN_TYPE_LABEL[run.type] : RUN_TYPE_LABEL[run.type]}
      </span>
    </div>
  );
}
