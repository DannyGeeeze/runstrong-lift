"use client";

// Week page charts (phone and desktop). Plain SVG, no chart library.
// Each chart measures its container and draws at that width, so text stays 10-11px on a
// phone instead of being shrunk. Colors are the validated categorical slots in globals.css
// (--viz-*); text always uses the text tokens. Hover (mouse) or tap (touch) for details;
// every chart also has a table view.

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { formatDay } from "@/lib/dates";
import { RUN_TYPE_LABEL } from "@/lib/day";
import type { RunType } from "@/lib/types";

export interface MilesDay {
  date: string;
  miles: number;
  type: RunType;
  runNames: string[];
  /** Lift logged that day: its label and whether it was a real session (strength/plyo) or a light one. */
  lift: { label: string; light: boolean } | null;
}

export interface LiftWeek {
  monday: string;
  strength: number;
  plyo: number;
}

const isHard = (t: RunType) => t === "workout" || t === "race";

/** The rendered width of a chart's box, so the SVG can be drawn at 1:1. */
export function useChartWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(260, Math.round(el.clientWidth)));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Hover with a mouse, tap with a finger (tap again to close). */
export function hoverProps(i: number, set: (fn: (h: number | null) => number | null) => void) {
  return {
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === "mouse") set(() => i);
    },
    onClick: () => set((h) => (h === i ? null : i)),
  };
}

/** An even axis top (so the halfway gridline is a whole number). */
export function niceMax(v: number, steps = [4, 6, 8, 10, 12, 14, 16, 20, 24, 30, 40, 50]) {
  return steps.find((s) => s >= v) ?? Math.ceil(v / 10) * 10;
}

/** Bar with a 4px rounded top, square at the baseline. */
export function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return "";
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function ChartCard({
  title,
  subtitle,
  legend,
  table,
  children,
}: {
  title: string;
  subtitle: string;
  legend: ReactNode;
  table: ReactNode;
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="rounded-2xl border border-line bg-card p-4 lg:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-muted hover:bg-card-2 hover:text-ink"
        >
          {asTable ? "Chart" : "Table"}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">{legend}</div>
      <div className="relative mt-3">{asTable ? table : children}</div>
    </section>
  );
}

export function Swatch({ color, label, shape = "bar" }: { color: string; label: string; shape?: "bar" | "dot" | "ring" | "dash" }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {shape === "bar" && <span className="h-3 w-2.5 rounded-t-[3px]" style={{ background: color }} />}
      {shape === "dot" && <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />}
      {shape === "ring" && <span className="h-2.5 w-2.5 rounded-full border-2" style={{ borderColor: color }} />}
      {shape === "dash" && <span className="w-4 border-t-2 border-dashed" style={{ borderColor: color }} />}
      {label}
    </span>
  );
}

export function Tooltip({ x, children }: { x: number; children: ReactNode }) {
  // x is a fraction of the chart width; keep the box inside the card.
  const left = `clamp(0px, calc(${(x * 100).toFixed(2)}% - 90px), calc(100% - 180px))`;
  return (
    <div
      role="status"
      className="pointer-events-none absolute top-0 z-10 w-[180px] rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-lg"
      style={{ left }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Miles each day for the last 14 days, hard days highlighted, with a marker on days you lifted. */
export function MilesChart({
  days,
  width,
  today,
}: {
  days: MilesDay[];
  /** Fixed width (tests/previews); otherwise measured. */
  width?: number;
  /** Highlights today; days after it are "coming up". Defaults to the last day. */
  today?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, measured] = useChartWidth();
  const W = width ?? measured;
  // Two calendar weeks (when `today` is given): label each and mark where this week starts.
  const twoWeeks = !!today && days.length === 14;
  const H = twoWeeks ? 236 : 220;
  const top = twoWeeks ? 28 : 12;
  const plotH = 140;
  const left = 34;
  const band = (W - left) / days.length;
  const bar = Math.max(8, Math.min(18, band * 0.55));
  const narrow = band < 30;
  const max = niceMax(Math.max(4, ...days.map((d) => d.miles)));
  const y = (m: number) => top + plotH - (m / max) * plotH;
  const ticks = [0, max / 2, max];
  const total = days.reduce((s, d) => s + d.miles, 0);

  const legend = (
    <>
      <Swatch color="var(--viz-easy)" label="Easy / long" />
      <Swatch color="var(--viz-hard)" label="Workout / race" />
      <Swatch color="var(--text)" label="Lift" shape="dot" />
      <Swatch color="var(--text)" label="Light session" shape="ring" />
    </>
  );
  const table = (
    <table className="w-full text-left text-xs">
      <thead className="text-muted">
        <tr>
          <th className="py-1 font-medium">Day</th>
          <th className="py-1 font-medium">Run</th>
          <th className="py-1 text-right font-medium">Miles</th>
          <th className="py-1 pl-4 font-medium">Lift</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {days.map((d) => (
          <tr key={d.date}>
            <td className="py-1.5">{formatDay(d.date)}</td>
            <td className="py-1.5">{RUN_TYPE_LABEL[d.type]}</td>
            <td className="py-1.5 text-right tabular-nums">{d.miles ? d.miles.toFixed(1) : "–"}</td>
            <td className="py-1.5 pl-4">{d.lift?.label ?? "–"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const h = hover !== null ? days[hover] : null;
  return (
    <ChartCard
      title="Miles per day"
      subtitle={today ? `Last week and this week · ${total.toFixed(1)} mi` : `Last 14 days · ${total.toFixed(1)} mi`}
      legend={legend}
      table={table}
    >
      <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Miles per day for the last 14 days, ${total.toFixed(1)} miles in total`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1 : 0.6} />
            <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)" className="tabular-nums">
              {t}
            </text>
          </g>
        ))}
        {twoWeeks && (
          <g>
            <text x={left + band * 3.5} y={12} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--muted)">
              Last week
            </text>
            <text x={left + band * 10.5} y={12} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text)">
              This week
            </text>
            <line x1={left + band * 7} x2={left + band * 7} y1={4} y2={top + plotH + 56} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
          </g>
        )}
        {days.map((d, i) => {
          const cx = left + band * i + band / 2;
          const bh = y(0) - y(d.miles);
          const ahead = !!today && d.date > today;
          const isToday = today ? d.date === today : i === days.length - 1;
          const [weekday, , dayNum] = formatDay(d.date).replace(",", "").split(" ");
          return (
            <g key={d.date}>
              {hover === i && <rect x={left + band * i + 1} y={top} width={band - 2} height={plotH} rx="6" fill="var(--card-2)" />}
              <path d={barPath(cx - bar / 2, y(d.miles), bar, bh)} fill={isHard(d.type) ? "var(--viz-hard)" : "var(--viz-easy)"} />
              {/* Lift marker row */}
              {d.lift &&
                (d.lift.light ? (
                  <circle cx={cx} cy={top + plotH + 16} r="4" fill="none" stroke="var(--text)" strokeWidth="2" />
                ) : (
                  <circle cx={cx} cy={top + plotH + 16} r="5" fill="var(--text)" />
                ))}
              <text x={cx} y={top + plotH + 38} textAnchor="middle" fontSize="10" fill={isToday ? "var(--text)" : "var(--muted)"} fontWeight={isToday ? 700 : 500} opacity={ahead ? 0.45 : 1}>
                {weekday.slice(0, narrow ? 1 : 2)}
              </text>
              <text x={cx} y={top + plotH + 52} textAnchor="middle" fontSize="10" fill={isToday ? "var(--text)" : "var(--muted)"} className="tabular-nums" opacity={ahead ? 0.45 : 1}>
                {dayNum}
              </text>
              {/* Hit target: the whole column */}
              <rect
                x={left + band * i}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                {...hoverProps(i, setHover)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${formatDay(d.date)}: ${RUN_TYPE_LABEL[d.type]}, ${d.miles.toFixed(1)} miles${d.lift ? `, lifted: ${d.lift.label}` : ""}`}
              />
            </g>
          );
        })}
        <text x={left - 6} y={top + plotH + 16} dy="0.32em" textAnchor="end" fontSize="9" fill="var(--muted)">
          lift
        </text>
        {total === 0 && (
          <text x={(W + left) / 2} y={top + plotH / 2} textAnchor="middle" fontSize="12" fill="var(--muted)">
            {narrow ? "No runs these two weeks." : "No runs these two weeks. Connect Strava or turn on demo runs in Settings."}
          </text>
        )}
      </svg>
      </div>
      {h && hover !== null && (
        <Tooltip x={(left + band * hover + band / 2) / W}>
          <p className="font-semibold">{formatDay(h.date)}</p>
          <p className="mt-0.5 text-muted">
            {RUN_TYPE_LABEL[h.type]}
            {h.miles ? ` · ${h.miles.toFixed(1)} mi` : ""}
          </p>
          {h.runNames.length > 0 && <p className="truncate text-muted">{h.runNames.join(", ")}</p>}
          <p className="mt-1">{today && h.date > today ? "Coming up" : h.lift ? `Lift: ${h.lift.label}` : "No lift"}</p>
        </Tooltip>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------

/** Strength and plyo sessions per calendar week, against the 2-a-week cap. */
export function LiftsChart({ weeks, cap = 2, width }: { weeks: LiftWeek[]; cap?: number; width?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const [box, measured] = useChartWidth();
  const W = width ?? measured;
  const H = 200;
  const top = 12;
  const plotH = 140;
  const left = 34;
  const band = (W - left) / weeks.length;
  const bar = Math.max(8, Math.min(18, band * 0.3));
  // Narrow screens: label every other week (always this week).
  const sparse = band < 52;
  const max = Math.max(3, ...weeks.flatMap((w) => [w.strength, w.plyo]));
  const y = (n: number) => top + plotH - (n / max) * plotH;
  const ticks = Array.from({ length: max + 1 }, (_, i) => i);
  const label = (monday: string) => formatDay(monday).split(", ")[1] ?? monday;

  const legend = (
    <>
      <Swatch color="var(--viz-strength)" label="Strength" />
      <Swatch color="var(--viz-plyo)" label="Plyo" />
      <Swatch color="var(--muted)" label={`Cap: ${cap} a week each`} shape="dash" />
    </>
  );
  const table = (
    <table className="w-full text-left text-xs">
      <thead className="text-muted">
        <tr>
          <th className="py-1 font-medium">Week of</th>
          <th className="py-1 text-right font-medium">Strength</th>
          <th className="py-1 text-right font-medium">Plyo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {weeks.map((w) => (
          <tr key={w.monday}>
            <td className="py-1.5">{label(w.monday)}</td>
            <td className="py-1.5 text-right tabular-nums">{w.strength}</td>
            <td className="py-1.5 text-right tabular-nums">{w.plyo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const h = hover !== null ? weeks[hover] : null;
  const empty = weeks.every((w) => w.strength === 0 && w.plyo === 0);
  return (
    <ChartCard title="Lifting per week" subtitle={`Last ${weeks.length} weeks, Mon–Sun`} legend={legend} table={table}>
      <div ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Strength and plyo sessions per week" onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1 : 0.6} />
            <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        <line x1={left} x2={W} y1={y(cap)} y2={y(cap)} stroke="var(--muted)" strokeWidth="1.2" strokeDasharray="4 4" />
        {weeks.map((w, i) => {
          const cx = left + band * i + band / 2;
          const isThis = i === weeks.length - 1;
          return (
            <g key={w.monday}>
              {hover === i && <rect x={left + band * i + 2} y={top} width={band - 4} height={plotH} rx="6" fill="var(--card-2)" />}
              {/* Two touching bars with a 2px surface gap */}
              <path d={barPath(cx - bar - 1, y(w.strength), bar, y(0) - y(w.strength))} fill="var(--viz-strength)" />
              <path d={barPath(cx + 1, y(w.plyo), bar, y(0) - y(w.plyo))} fill="var(--viz-plyo)" />
              <text
                x={isThis && cx + 22 > W ? W - 1 : cx}
                y={top + plotH + 18}
                textAnchor={isThis && cx + 22 > W ? "end" : "middle"}
                fontSize="10"
                fill={isThis ? "var(--text)" : "var(--muted)"}
                fontWeight={isThis ? 700 : 500}
              >
                {isThis ? "This wk" : sparse && (weeks.length - 1 - i) % 2 === 1 ? "" : label(w.monday)}
              </text>
              <rect
                x={left + band * i}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                tabIndex={0}
                {...hoverProps(i, setHover)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`Week of ${label(w.monday)}: ${w.strength} strength, ${w.plyo} plyo`}
              />
            </g>
          );
        })}
        {empty && (
          <text x={(W + left) / 2} y={top + plotH / 2} textAnchor="middle" fontSize="12" fill="var(--muted)">
            {sparse ? "No lifts logged yet." : "No lifts logged yet. Mark a workout complete and it shows up here."}
          </text>
        )}
      </svg>
      </div>
      {h && hover !== null && (
        <Tooltip x={(left + band * hover + band / 2) / W}>
          <p className="font-semibold">Week of {label(h.monday)}</p>
          <p className="mt-0.5">
            {h.strength} strength · {h.plyo} plyo
          </p>
          {(h.strength > cap || h.plyo > cap) && <p className="mt-0.5 text-muted">Over the {cap}-a-week cap</p>}
        </Tooltip>
      )}
    </ChartCard>
  );
}
