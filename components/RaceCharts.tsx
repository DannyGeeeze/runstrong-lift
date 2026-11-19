"use client";

// Desktop Races page charts. Plain SVG, sized close to 1:1 for their column so text stays readable.
// Colors: the phase strip is an ordered one-hue ramp (--viz-phase-*), races use the hard-day
// orange from the Week page, and lifting uses the Week page's strength/plyo colors.

import { useState } from "react";
import { addDays, diffDays, formatDay, mondayOf } from "@/lib/dates";
import { PHASE_LABEL, suggestPhase } from "@/lib/rules";
import type { LiftLog, Phase, Race, RacePriority } from "@/lib/types";
import { barPath, ChartCard, Swatch, Tooltip } from "./WeekCharts";

const PHASE_COLOR: Record<Phase, string> = {
  off: "var(--viz-phase-off)",
  early: "var(--viz-phase-early)",
  deep: "var(--viz-phase-deep)",
  championship: "var(--viz-phase-championship)",
};
const PHASES: Phase[] = ["off", "early", "deep", "championship"];
const PRIORITY_NAME: Record<RacePriority, string> = { A: "Goal race", B: "Key race", C: "Meet" };
const RADIUS: Record<RacePriority, number> = { A: 8, B: 6, C: 4.5 };
const short = (d: string) => formatDay(d).split(", ")[1] ?? d;

// ---------------------------------------------------------------------------

/** The season week by week: the phase the app would suggest, and every race on the calendar. */
export function SeasonMap({ races, today, phase }: { races: Race[]; today: string; phase: Phase }) {
  const [hover, setHover] = useState<{ kind: "race"; i: number } | { kind: "week"; i: number } | null>(null);
  const VW = 680;
  const H = 142;
  const left = 8;
  const right = 8;

  // From 4 weeks ago to a week past the last race (at least 8 weeks ahead), at most 26 weeks.
  const start = addDays(mondayOf(today), -28);
  const lastRace = races.reduce((m, r) => (r.date > m ? r.date : m), today);
  const endMonday = mondayOf(addDays(lastRace > addDays(today, 56) ? lastRace : addDays(today, 56), 7));
  const weekCount = Math.min(26, Math.max(12, diffDays(start, endMonday) / 7 + 1));
  const weeks = Array.from({ length: weekCount }, (_, i) => addDays(start, i * 7));
  const end = addDays(start, weekCount * 7);
  const span = diffDays(start, end);
  const x = (date: string) => left + (diffDays(start, date) / span) * (VW - left - right);
  const weekW = (VW - left - right) / weekCount;

  const shown = races.filter((r) => r.date >= start && r.date < end);
  const weekPhase = weeks.map((m) => suggestPhase(races, m));

  const ROW = 56; // race markers
  const STRIP = 86; // phase strip top
  const STRIP_H = 16;

  // Phase segments (consecutive weeks with the same phase) for labels under the strip.
  const segments: { phase: Phase; from: number; to: number }[] = [];
  weekPhase.forEach((p, i) => {
    const last = segments[segments.length - 1];
    if (last && last.phase === p.phase) last.to = i;
    else segments.push({ phase: p.phase, from: i, to: i });
  });

  const legend = (
    <>
      {PHASES.map((p) => (
        <Swatch key={p} color={PHASE_COLOR[p]} label={PHASE_LABEL[p]} shape="bar" />
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full" style={{ background: "var(--viz-hard)" }} />
        Upcoming race
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: "var(--viz-hard)" }} />
        Past race
      </span>
      <span>Bigger dot = bigger race</span>
    </>
  );
  const table = (
    <table className="w-full text-left text-xs">
      <thead className="text-muted">
        <tr>
          <th className="py-1 font-medium">Week of</th>
          <th className="py-1 font-medium">Suggested phase</th>
          <th className="py-1 font-medium">Races</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {weeks.map((m, i) => {
          const rs = shown.filter((r) => r.date >= m && r.date < addDays(m, 7));
          return (
            <tr key={m}>
              <td className="py-1.5">{short(m)}</td>
              <td className="py-1.5">{PHASE_LABEL[weekPhase[i].phase]}</td>
              <td className="py-1.5">{rs.map((r) => `${r.name} (${PRIORITY_NAME[r.priority]})`).join(", ") || "–"}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const tip = (() => {
    if (!hover) return null;
    if (hover.kind === "race") {
      const r = shown[hover.i];
      const d = diffDays(today, r.date);
      return (
        <Tooltip x={x(r.date) / VW}>
          <p className="font-semibold">{r.name}</p>
          <p className="mt-0.5 text-muted">
            {formatDay(r.date)} · {PRIORITY_NAME[r.priority]}
          </p>
          <p className="mt-0.5">{d === 0 ? "Today" : d > 0 ? `In ${d} day${d === 1 ? "" : "s"}` : `${-d} day${d === -1 ? "" : "s"} ago`}</p>
        </Tooltip>
      );
    }
    const m = weeks[hover.i];
    const p = weekPhase[hover.i];
    return (
      <Tooltip x={(x(m) + weekW / 2) / VW}>
        <p className="font-semibold">Week of {short(m)}</p>
        <p className="mt-0.5">{PHASE_LABEL[p.phase]}</p>
        <p className="mt-0.5 text-muted">{p.reason}</p>
      </Tooltip>
    );
  })();

  const tx = x(today);
  return (
    <ChartCard
      title="Season map"
      subtitle={`Suggested phase by week · you're set to ${PHASE_LABEL[phase]}`}
      legend={legend}
      table={table}
    >
      <svg viewBox={`0 0 ${VW} ${H}`} className="block w-full" role="img" aria-label="Season map: suggested phase by week and races" onMouseLeave={() => setHover(null)}>
        {/* Race row baseline */}
        <line x1={left} x2={VW - right} y1={ROW} y2={ROW} stroke="var(--border)" strokeWidth="1" />
        {/* Today */}
        <line x1={tx} x2={tx} y1={14} y2={STRIP + STRIP_H + 4} stroke="var(--text)" strokeWidth="1.2" strokeDasharray="3 3" />
        <text x={tx} y={10} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text)">
          Today
        </text>

        {/* Phase strip: one block per week, 2px surface gap between them */}
        {weeks.map((m, i) => (
          <g key={m}>
            <rect
              x={x(m) + 1}
              y={STRIP}
              width={Math.max(1, weekW - 2)}
              height={STRIP_H}
              rx="3"
              fill={PHASE_COLOR[weekPhase[i].phase]}
              opacity={hover?.kind === "week" && hover.i !== i ? 0.55 : 1}
            />
            <rect
              x={x(m)}
              y={STRIP - 6}
              width={weekW}
              height={STRIP_H + 12}
              fill="transparent"
              tabIndex={0}
              aria-label={`Week of ${short(m)}: ${PHASE_LABEL[weekPhase[i].phase]}`}
              onMouseEnter={() => setHover({ kind: "week", i })}
              onFocus={() => setHover({ kind: "week", i })}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}
        {/* Phase names under the strip, for segments wide enough to hold them */}
        {segments.map((sg) => {
          const w = (sg.to - sg.from + 1) * weekW;
          if (w < 56) return null;
          return (
            <text key={sg.from} x={x(weeks[sg.from]) + 2} y={STRIP + STRIP_H + 14} fontSize="10" fill="var(--muted)">
              {PHASE_LABEL[sg.phase]}
            </text>
          );
        })}
        {/* Month-ish date labels every 2 weeks */}
        {weeks.map((m, i) =>
          i % 2 === 0 ? (
            <text key={m} x={x(m) + 2} y={H - 4} fontSize="10" fill="var(--muted)">
              {short(m)}
            </text>
          ) : null,
        )}

        {/* Races */}
        {shown.map((r, i) => {
          const cx = x(r.date) + weekW / 14;
          const past = r.date < today;
          const rad = RADIUS[r.priority];
          return (
            <g key={r.id}>
              {r.priority === "A" && (
                <text x={cx} y={ROW - rad - 8} textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text)">
                  {r.name.length > 26 ? `${r.name.slice(0, 25)}…` : r.name}
                </text>
              )}
              <circle
                cx={cx}
                cy={ROW}
                r={rad}
                fill={past ? "var(--card)" : "var(--viz-hard)"}
                stroke={past ? "var(--viz-hard)" : "var(--card)"}
                strokeWidth="2"
              />
              <circle
                cx={cx}
                cy={ROW}
                r={rad + 7}
                fill="transparent"
                tabIndex={0}
                aria-label={`${r.name}, ${formatDay(r.date)}, ${PRIORITY_NAME[r.priority]}`}
                onMouseEnter={() => setHover({ kind: "race", i })}
                onFocus={() => setHover({ kind: "race", i })}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
        {shown.length === 0 && (
          <text x={VW / 2} y={ROW + 4} textAnchor="middle" fontSize="12" fill="var(--muted)">
            No races yet. Add your meets and the season fills in.
          </text>
        )}
      </svg>
      {tip}
    </ChartCard>
  );
}

// ---------------------------------------------------------------------------

/** For each past race: strength and plyo sessions in the 7 days before it. */
export function LiftsBeforeRaces({ races, history, today }: { races: Race[]; history: LiftLog[]; today: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const VW = 420;
  const H = 210;
  const top = 12;
  const plotH = 130;
  const left = 26;
  const BAR = 14;
  const past = races
    .filter((r) => r.date < today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8);
  const rows = past.map((r) => {
    const from = addDays(r.date, -7);
    const before = history.filter((h) => h.date >= from && h.date < r.date);
    return { race: r, strength: before.filter((h) => h.hadStrength).length, plyo: before.filter((h) => h.hadPlyo).length };
  });
  const max = Math.max(2, ...rows.flatMap((r) => [r.strength, r.plyo]));
  const y = (n: number) => top + plotH - (n / max) * plotH;
  const band = rows.length ? (VW - left) / rows.length : VW - left;

  const legend = (
    <>
      <Swatch color="var(--viz-strength)" label="Strength" />
      <Swatch color="var(--viz-plyo)" label="Plyo" />
    </>
  );
  const table = (
    <table className="w-full text-left text-xs">
      <thead className="text-muted">
        <tr>
          <th className="py-1 font-medium">Race</th>
          <th className="py-1 text-right font-medium">Strength</th>
          <th className="py-1 text-right font-medium">Plyo</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.race.id}>
            <td className="py-1.5">
              {r.race.name} · {short(r.race.date)}
            </td>
            <td className="py-1.5 text-right tabular-nums">{r.strength}</td>
            <td className="py-1.5 text-right tabular-nums">{r.plyo}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const h = hover !== null ? rows[hover] : null;
  return (
    <ChartCard title="Lifting before races" subtitle="Sessions in the 7 days before each past race" legend={legend} table={table}>
      <svg viewBox={`0 0 ${VW} ${H}`} className="block w-full" role="img" aria-label="Strength and plyo sessions in the week before each past race" onMouseLeave={() => setHover(null)}>
        {Array.from({ length: max + 1 }, (_, t) => (
          <g key={t}>
            <line x1={left} x2={VW} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1 : 0.6} />
            <text x={left - 6} y={y(t)} dy="0.32em" textAnchor="end" fontSize="10" fill="var(--muted)">
              {t}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cx = left + band * i + band / 2;
          const name = r.race.name.length > 10 ? `${r.race.name.slice(0, 9)}…` : r.race.name;
          return (
            <g key={r.race.id}>
              {hover === i && <rect x={left + band * i + 2} y={top} width={band - 4} height={plotH} rx="6" fill="var(--card-2)" />}
              <path d={barPath(cx - BAR - 1, y(r.strength), BAR, y(0) - y(r.strength))} fill="var(--viz-strength)" />
              <path d={barPath(cx + 1, y(r.plyo), BAR, y(0) - y(r.plyo))} fill="var(--viz-plyo)" />
              <text x={cx} y={top + plotH + 16} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {short(r.race.date)}
              </text>
              <text x={cx} y={top + plotH + 30} textAnchor="middle" fontSize="9" fill="var(--muted)">
                {name}
              </text>
              <rect
                x={left + band * i}
                y={0}
                width={band}
                height={H}
                fill="transparent"
                tabIndex={0}
                aria-label={`${r.race.name}: ${r.strength} strength, ${r.plyo} plyo in the week before`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
        {rows.length === 0 && (
          <text x={(VW + left) / 2} y={top + plotH / 2} textAnchor="middle" fontSize="11" fill="var(--muted)">
            No past races yet.
          </text>
        )}
      </svg>
      {h && hover !== null && (
        <Tooltip x={(left + band * hover + band / 2) / VW}>
          <p className="font-semibold">{h.race.name}</p>
          <p className="mt-0.5 text-muted">{formatDay(h.race.date)}</p>
          <p className="mt-1">
            Week before: {h.strength} strength · {h.plyo} plyo
          </p>
        </Tooltip>
      )}
    </ChartCard>
  );
}
