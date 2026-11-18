"use client";

import { useState } from "react";
import { Button, Card, Notice } from "@/components/ui";
import { RECOVERY_LABEL, SAUNA_TIP, suggestRecovery, type RecoveryInput } from "@/lib/rules";
import { newId, storage } from "@/lib/storage";
import type { RecoveryKind } from "@/lib/types";

const SHORT: Record<RecoveryKind, string> = { boots: "Boots", sauna: "Sauna" };

/** Today's recovery: a suggestion (boots, sauna or nothing) the runner can switch and log. */
export function RecoveryCard(props: RecoveryInput) {
  const s = suggestRecovery(props);
  // undefined = go with the suggestion; null = skip.
  const [pick, setPick] = useState<RecoveryKind | null | undefined>(undefined);
  if (s.options.length === 0) return null;

  const loggedToday = props.recovery.filter((r) => r.date === props.today);
  const done = new Set(loggedToday.map((r) => r.kind));
  const chosen = pick === undefined ? (s.kind && !done.has(s.kind) ? s.kind : null) : pick;
  const choices: (RecoveryKind | null)[] = [...s.options, null];

  return (
    <Card className="mt-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-accent">Recovery suggestion</p>
      <div className="space-y-3">
        {loggedToday.length > 0 && (
          <Notice tone="good">Done today: {loggedToday.map((r) => RECOVERY_LABEL[r.kind]).join(", ")}.</Notice>
        )}
        <div className={`grid gap-1 rounded-xl bg-card p-1 ring-1 ring-line ${choices.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
          {choices.map((k) => (
            <button
              key={k ?? "skip"}
              type="button"
              aria-pressed={chosen === k}
              onClick={() => setPick(k)}
              className={`min-h-10 rounded-lg px-1 text-sm font-semibold transition-colors ${
                chosen === k ? "bg-accent text-accent-ink" : "text-muted"
              }`}
            >
              {k ? SHORT[k] + (done.has(k) ? " ✓" : "") : "Skip"}
            </button>
          ))}
        </div>
        <p className="text-sm font-medium">{s.why}</p>
        {chosen === "sauna" && s.saunaWarning && <Notice tone="warn">Heads up: {s.saunaWarning}.</Notice>}
        {chosen === "sauna" && <p className="text-sm text-muted">{SAUNA_TIP}</p>}
        {chosen && !done.has(chosen) && (
          <Button
            className="w-full"
            onClick={() => {
              storage.addRecovery({ id: newId(), date: props.today, kind: chosen });
              setPick(undefined);
            }}
          >
            Log {RECOVERY_LABEL[chosen].toLowerCase()}
          </Button>
        )}
      </div>
    </Card>
  );
}
