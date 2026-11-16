# RunStrong Lift — Build Plan

Source of truth: [BRIEF.md](BRIEF.md). Decisions made along the way go in `DECISIONS.md`.

## 0. What's in the repo today

- `BRIEF.md`: the spec.
- `data/runstrong_exercises.json`: 43 featured + 299 library exercises, plus `_meta.slots`.

What the data shows, and what it means for the build:

| Finding | Impact / decision |
|---|---|
| **None of the 43 featured exercises have a `video_url`** (all 299 library ones do) | The "watch" link only shows when a URL exists. Featured items fall back to the coach's library browse page for their slot category. Logged in DECISIONS.md. |
| Only 5 exercises are tagged `short` (drop jump, back squat, RDL, BB calf raise, SL calf raise) | The Short session is basically a fixed template. It is built from slots and session type, so new JSON entries still flow in. |
| Session types in the data: `full`, `plyos-isos`, `touch-up`, `short`, `return`, **`taper`** | `taper` isn't in the brief. I'll use it for the Championship "race day = a few isos" case (and fall back to `plyos-isos` if there aren't enough). |
| The `ISO` slot (4 featured) has no `isometric` field. Library isos use `isometric: overcoming / yielding / iso` | Helper `isoKind(ex)`: use `isometric` if present, else read it from the name ("overcoming", "yielding"), else treat it as generic `iso`. |
| `intensity` is `low / med / high` | "Low/medium plyos" for Plyos + Isos = `intensity ∈ {low, med}`. |
| `plyo_type` also includes `loaded`, `rhythm`, `other`, `oscillation` | Only the 4 brief categories (deep, pogo, single-leg-hop, lateral) count toward weekly rotation. The others can be picked but don't fill rotation. |
| One featured item has `phases: ["off-season","early"]` | Respect an optional `phases` filter (used for extra lateral volume such as monster walks). |
| Only 2 featured + 10 library items are tagged `return`, and only 3 are explicitly yielding | Return week = items tagged `return` with yielding or iso kind, 20–45 s holds. Enough to build 3–4 moves. |
| Library `tier` (light/medium/ping/deep) | Used as a secondary intensity hint for plyos. |

## 1. Stack and structure

Next.js (App Router) + TypeScript + Tailwind, Vitest for tests, deployed to Vercel free tier. No database and no LLM.

```
app/
  page.tsx                 Today: run, Generate, workout card
  week/page.tsx            7-day runs + lifts, strength/plyo counts
  races/page.tsx           Race schedule CRUD + next race countdown
  settings/page.tsx        Phase, tune-up day, toggles, export/import
  api/strava/
    login/route.ts         Redirect to Strava authorize (scope activity:read_all)
    callback/route.ts      Exchange code, set httpOnly cookie
    activities/route.ts    Proxy: refresh token if expired, return last 14 days
    logout/route.ts
lib/
  rules/                   ← the coach's system, heavily commented
    rules.ts               When-to-lift decision table (pure functions)
    sessions.ts            Session templates: slots, dosing, durations
    select.ts              Exercise picking: featured ~70%, block picks, plyo rotation
    index.ts               generateWorkout(context) → Workout
  exercises.ts             Load + validate JSON, isoKind(), filters
  storage.ts               ONE module: races, settings, history, block picks (localStorage now)
  strava.ts                Activity → Run mapping, workout_type → Easy/Long/Workout/Race
  mock.ts                  Mock activities + races for demo mode
  dates.ts                 Local-date helpers (all "today" logic in the user's timezone)
components/                Mobile UI pieces (ExerciseCard, RunCard, BottomNav…)
tests/rules/*.test.ts
```

## 2. Core data model

```ts
type RunType = 'easy' | 'long' | 'workout' | 'race' | 'rest';
type Phase = 'off' | 'early' | 'deep' | 'championship';
type SessionType = 'full' | 'full-half' | 'short' | 'plyos-isos' | 'taper' | 'return' | 'touch-up' | 'none';

interface DayPlan { date: string; type: RunType; source: 'strava' | 'override' | 'race-schedule' | 'assumed' }
interface Race { id; date; name; distance; priority: 'A'|'B'|'C' }
interface Settings { phase; tuneUpDay: 'mon'|'tue'; returnWeek; enablePower; enableMobility; shortOnTime; mockMode }
interface LiftLog { date; sessionType; exerciseIds[]; hadStrength: boolean; hadPlyo: boolean }
interface BlockPicks { startedOn: string; bySlot: Record<Slot, string[]> }   // rotate after 3–4 weeks
```

**Knowing future hard days.** The 48h rule needs to know when the next hard day is. Hard days come from: race schedule dates, the tune-up day setting (Mon/Tue before each race), and any manual overrides. Those three cover the "two hard days before the race" logic without needing a full training calendar.

## 3. Rules engine (the core, written test-first)

`generateWorkout(ctx)` runs in this order, and every step records the rule it applied so the "why this today" sentence names it:

1. **Day type.** Easy or Long → offer an optional `touch-up` (or nothing). Rest → nothing.
2. **Race-week role.** Is today the race, the tune-up, or the 1st/2nd hard day before a non-Thursday race?
3. **Phase table** picks the base session:
   - Thursday race: Early (W = Full, R = Full); Deep (W = Full, R = Full-half *or* Plyos + Isos, defaulting to Full-half with a toggle); Champ (W = Plyos + Isos, R = none / taper).
   - Other race day: Early (1st = Full, 2nd = Full-half); Deep (1st = Full, 2nd = Plyos + Isos); Champ (both = Plyos + Isos).
   - Off-season: workout day = Full with all 7 slots + 1 UPPER.
4. **48h guard.** If the next hard day is less than 48h away and the session includes strength, downgrade to Plyos + Isos. If the tune-up is Tuesday and the race is Thursday, show the "right at the 48h limit" warning.
5. **Weekly caps.** Count the rolling 7 days in history. If there have been 2 or more strength sessions, strip strength. If 2 or more plyo sessions, strip plyos. Whatever is left is the session (it can end up as isos only).
6. **Modifiers.** Return week → `return` (yielding isos only). Short on time → `short` (only if strength is still allowed).
7. **Next-morning catch-up.** If yesterday was a workout day with no lift logged and the next hard run is 48h+ away, offer "Lift this morning".
8. **Select exercises** (`select.ts`): for each slot, filter by `session_types`, `phases`, POWER/MOBILITY toggles, and the UPPER rule (max 1, Full only). Then prefer current block picks. Otherwise pick featured about 70% of the time using a seeded RNG, so tests are deterministic and Regenerate just changes the seed. Plyo choice favors a `plyo_type` not yet done in the last 7 days.
9. **Dosing.** Use JSON sets and reps, with caps: Nordics at most 3x3, B1 at 3x3–5 @ RPE 7, and half volume halves the sets (minimum 1). In-season Full has 1–2 plyos + 4–5 strength moves, 6 total at most. Overcoming isos are 3–5 s pushes x5. Yielding isos are 20–45 s holds.
10. **Output.** Warm-up block, ordered exercises (sets, reps or time, rest, cue, watch link), estimated duration (from sets, reps, and rest, capped at about 45 min for Full), and the "why" sentence.

**Regenerate.** It keeps the session type and slot list and re-picks exercises within each slot. A test checks that every result still meets the same constraints.

## 4. Strava

- `/api/strava/login` → Strava authorize → `/api/strava/callback` exchanges the code and stores `{access, refresh, expires_at}` in an encrypted httpOnly cookie (using `iron-session` or a small AES-GCM helper with `SESSION_SECRET`).
- `/api/strava/activities` refreshes the token when it is within 5 min of expiry, fetches `after = now - 14d`, filters to runs, and returns trimmed fields (distance, moving_time, pace, average_heartrate, workout_type, start_date_local).
- `workout_type` mapping for runs: 0 default → Easy, 1 race → Race, 2 long → Long, 3 workout → Workout. The user can override, and the override is saved per date in storage.
- Env vars: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL` (optional).

## 5. Mock mode

When there are no Strava env vars or the setting is on, `mock.ts` supplies 14 days of realistic runs (around 55 mi/wk, a Tuesday workout, Thursday races, a Saturday long run) plus a sample race schedule. A banner says "Demo data".

## 6. UI (phone-first)

A bottom tab bar with Today · Week · Races · Settings. The Today screen shows the run card (with a type override chip row) and a big **Generate workout** button. Under that comes the workout card (warm-up, exercise list with a checkbox on each, a "watch" link, and the estimated time), followed by **Regenerate** and **Mark complete** (which saves to history). The next race and its countdown sit in the header. Dark-friendly and one-hand reachable.

## 7. Tests (Vitest), as the brief requires

- Thursday race × {early, deep, championship} for both the workout day and the race day
- Tuesday tune-up → 48h warning; Monday tune-up → no warning
- Other race days × each phase (1st and 2nd hard day)
- 48h downgrade (Full → Plyos + Isos)
- Weekly caps (2 strength or 2 plyo sessions in 7 days)
- Easy and Long → touch-up only; Rest → none
- Next-morning catch-up allowed or blocked
- Regenerate keeps session type, slots, the UPPER limit, and the 6-exercise in-season cap
- Data tests: every exercise has the required fields, and every session template can be filled from the JSON

## 8. Build order (each step is a commit)

1. Scaffold Next.js, Tailwind, and Vitest; add `DECISIONS.md` and this plan
2. `exercises.ts` + `storage.ts` + `dates.ts` + types
3. Rules engine + tests (the core of the work)
4. Mock data + the Today screen wired to the engine (the app works end to end in demo mode)
5. Races, Settings (phase suggestion, export/import), Week views
6. Strava OAuth routes + token refresh + activity mapping
7. Polish: mobile UI pass, empty states, error handling
8. `SETUP.md` (Strava app at strava.com/settings/api with callback domain `localhost` locally and `<project>.vercel.app` on Vercel, env vars, `vercel` deploy steps), then push

## 9. Open questions (I'll pick a default and log each one in DECISIONS.md rather than block)

- Deep-season Thursday race day: Full-half or Plyos + Isos? → Default Full-half, with a one-tap switch.
- Days with two runs: use the hardest type of the day.
- "Today" timezone: the device's local time.
- Block rotation: rotate automatically after 28 days, with a manual "new block" button in Settings.
