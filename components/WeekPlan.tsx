"use client";

import { formatDay } from "@/lib/dates";
import { RUN_TYPE_LABEL } from "@/lib/day";
import type { PlanDay } from "@/lib/plan";
import type { RunType } from "@/lib/types";

const TYPE_STYLE: Record<RunType, string> = {
  easy: "bg-card-2 text-muted",
  long: "bg-card-2 text-ink",
  workout: "bg-accent-soft text-accent",
  race: "bg-accent text-accent-ink",
  rest: "bg-card-2 text-muted",
};

/** Desktop: the next 7 days side by side. Click a day to see its planned lift. */
export function WeekPlan({ plan, selected, onSelect }: { plan: PlanDay[]; selected: string; onSelect: (date: string) => void }) {
  return (
    <section aria-label="Week plan" className="mt-6">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Next 7 days</h2>
        <span className="text-xs text-muted">Click a day to plan it</span>
      </div>
      <ol className="grid grid-cols-7 gap-2">
        {plan.map((d, i) => {
          const w = d.workout;
          const lift = w.decision.session !== "none";
          const isSel = d.date === selected;
          const [weekday, , dayNum] = formatDay(d.date).replace(",", "").split(" ");
          return (
            <li key={d.date} className="min-w-0">
              <button
                type="button"
                onClick={() => onSelect(d.date)}
                aria-pressed={isSel}
                className={`flex h-full w-full flex-col rounded-2xl border p-3 text-left transition ${
                  isSel ? "border-accent bg-card ring-2 ring-accent/30" : "border-line bg-card hover:border-muted/40"
                }`}
              >
                <span className="flex items-baseline justify-between gap-1">
                  <span className={`text-[11px] font-semibold uppercase tracking-wide ${i === 0 ? "text-accent" : "text-muted"}`}>
                    {i === 0 ? "Today" : weekday}
                  </span>
                  <span className="text-lg font-bold leading-none tabular-nums">{dayNum}</span>
                </span>
                <span className={`mt-2 self-start rounded-full px-2 py-0.5 text-[11px] font-semibold ${TYPE_STYLE[d.type]}`}>
                  {RUN_TYPE_LABEL[d.type]}
                </span>
                <span className={`mt-2 line-clamp-2 text-sm font-semibold leading-snug ${lift ? "" : "text-muted"}`}>
                  {lift ? w.title : d.type === "race" ? "Race day" : "No lift"}
                </span>
                <span className="mt-auto pt-1 text-xs text-muted">
                  {lift ? `~${w.estMinutes} min${w.decision.optional ? " · optional" : ""}` : " "}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
