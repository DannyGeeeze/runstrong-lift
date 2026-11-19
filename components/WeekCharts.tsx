"use client";

// Desktop Week page charts. Plain SVG, no chart library.
// Colors are the validated categorical slots in globals.css (--viz-*); text always
// uses the text tokens, never a series color. Each chart has hover details and a table view.

import { useState, type ReactNode } from "react";
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

const W = 640;
const BAR = 18;
const isHard = (t: RunType) => t === "workout" || t === "race";

/** An even axis top (so the halfway gridline is a whole number). */
function niceMax(v: number, steps = [4, 6, 8, 10, 12, 14, 16, 20, 24, 30, 40, 50]) {
  return steps.find((s) => s >= v) ?? Math.ceil(v / 10) * 10;
}

/** Bar with a 4px rounded top, square at the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, h, w / 2);
  if (h <= 0) return "";
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function ChartCard({
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
    <section className="rounded-2xl border border-line bg-card p-5">
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

function Swatch({ color, label, shape = "bar" }: { color: string; label: string; shape?: "bar" | "dot" | "ring" | "dash" }) {
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

function Tooltip({ x, children }: { x: number; children: ReactNode }) {
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
export function MilesChart({ days }: { days: MilesDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 220;
  const top = 12;
  const plotH = 140;
  const left = 34;
  const band = (W - left) / days.length;
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
    <ChartCard title="Miles per day" subtitle={`Last 14 days · ${total.toFixed(1)} mi`} legend={legend} table={table}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label={`Miles per day for the last 14 days, ${total.toFixed(1)} miles in total`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={left} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1 : 0.6} />
            <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)" className="tabular-nums">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = left + band * i + band / 2;
          const bh = y(0) - y(d.miles);
          const isToday = i === days.length - 1;
          const [weekday, , dayNum] = formatDay(d.date).replace(",", "").split(" ");
          return (
            <g key={d.date}>
              {hover === i && <rect x={left + band * i + 1} y={top} width={band - 2} height={plotH} rx="6" fill="var(--card-2)" />}
              <path d={barPath(cx - BAR / 2, y(d.miles), BAR, bh)} fill={isHard(d.type) ? "var(--viz-hard)" : "var(--viz-easy)"} />
              {/* Lift marker row */}
              {d.lift &&
                (d.lift.light ? (
                  <circle cx={cx} cy={top + plotH + 16} r="4" fill="none" stroke="var(--text)" strokeWidth="2" />
                ) : (
                  <circle cx={cx} cy={top + plotH + 16} r="5" fill="var(--text)" />
                ))}
              <text x={cx} y={top + plotH + 38} textAnchor="middle" fontSize="10" fill={isToday ? "var(--text)" : "var(--muted)"} fontWeight={isToday ? 700 : 500}>
                {weekday.slice(0, 2)}
              </text>
              <text x={cx} y={top + plotH + 52} textAnchor="middle" fontSize="10" fill={isToday ? "var(--text)" : "var(--muted)"} className="tabular-nums">
                {dayNum}
              </text>
              {/* Hit target: the whole column */}
              <rect
                x={left + band * i}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
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
            No runs in the last 14 days. Connect Strava or turn on demo runs in Settings.
          </text>
        )}
      </svg>
      {h && hover !== null && (
        <Tooltip x={(left + band * hover + band / 2) / W}>
          <p className="font-semibold">{formatDay(h.date)}</p>
          <p className="mt-0.5 text-muted">
            {RUN_TYPE_LABEL[h.type]}
            {h.miles ? ` · ${h.miles.toFixed(1)} mi` : ""}
          </p>
          {h.runNames.length > 0 && <p className="truncate text-muted">{h.runNames.join(", ")}</p>}
          <p className="mt-1">{h.lift ? `Lift: ${h.lift.label}` : "No lift"}</p>
        </Tooltip>
      )}
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------

/** Strength and plyo sessions per calendar week, against the 2-a-week cap. */
export function LiftsChart({ weeks, cap = 2 }: { weeks: LiftWeek[]; cap?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const H = 200;
  const top = 12;
  const plotH = 140;
  const left = 34;
  const band = (W - left) / weeks.length;
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
              <path d={barPath(cx - BAR - 1, y(w.strength), BAR, y(0) - y(w.strength))} fill="var(--viz-strength)" />
              <path d={barPath(cx + 1, y(w.plyo), BAR, y(0) - y(w.plyo))} fill="var(--viz-plyo)" />
              <text x={cx} y={top + plotH + 18} textAnchor="middle" fontSize="10" fill={isThis ? "var(--text)" : "var(--muted)"} fontWeight={isThis ? 700 : 500}>
                {isThis ? "This wk" : label(w.monday)}
              </text>
              <rect
                x={left + band * i}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                tabIndex={0}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`Week of ${label(w.monday)}: ${w.strength} strength, ${w.plyo} plyo`}
              />
            </g>
          );
        })}
        {empty && (
          <text x={(W + left) / 2} y={top + plotH / 2} textAnchor="middle" fontSize="12" fill="var(--muted)">
            No lifts logged yet. Mark a workout complete and it shows up here.
          </text>
        )}
      </svg>
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
