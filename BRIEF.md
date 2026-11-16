# RunStrong Lift — Build Brief

Build a mobile-first web app called "RunStrong Lift" that generates a strength workout for me (a high school distance runner) based on that day's run from Strava, my race schedule, and the training system of strength coach @the_runstrong_coach. I'll mostly use it on my phone. Work autonomously and don't stop to ask questions. Make reasonable decisions and log them in DECISIONS.md.

## Me
- HS cross country / track distance runner (5K+), ~55 miles/week, runs 5–6 days/week, 2–3 hard workouts/week.
- Races are usually on THURSDAY, with one tune-up workout earlier in the week (Monday or Tuesday — make this a setting).

## Stack
- Next.js (App Router) + TypeScript + Tailwind, deployable to Vercel free tier.
- Strava OAuth handled server-side (API routes) so the client secret never reaches the browser. Scope: activity:read_all. Store tokens in an httpOnly cookie and handle token refresh.
- Single user (me). Store race schedule, settings and lift history in localStorage for now, with JSON export/import. Keep storage behind one small module so I can swap in a database later.
- No paid APIs. Workout generation is rule-based (no LLM).

## Exercise bank (already in the repo)
- /data/runstrong_exercises.json has:
  - "featured": 43 exercises seen in the coach's videos, with his sets/reps.
  - "library": 299 exercises from his online library. Sets/reps/equipment/intensity on these are auto-assigned defaults.
  - "_meta.slots": what each slot code means.
- Each exercise has: id, name, slot, intensity, unilateral, sets, reps, session_types, and usually equipment, isometric, tier, cue, video_url.
- Prefer featured exercises ~70% of the time. Use library exercises to fill or vary a slot. Only pick exercises whose session_types include the session type being generated.
- At most 1 UPPER exercise per session, only in Full sessions. Ignore POWER and MOBILITY slots unless I turn them on in settings.
- Show video_url as a "watch" link on each exercise.
- Adding an exercise must just mean adding a JSON entry — no code changes.

## Features
1. **Connect Strava**: OAuth flow, then show my last 14 days of activities.
2. **Today's run**: auto-detect today's run(s): distance, time, pace, avg HR if present, and Strava's workout_type (race / long run / workout / default). Let me override the type: Easy, Long, Workout, Race, Rest.
3. **Race schedule**: add/edit/delete races (date, name, distance, priority A/B/C). Default new races to Thursday. Show next race + days until it.
4. **Season phase**: a setting with Off-season / Early / Deep / Championship. Suggest a phase from the race schedule (e.g. A-priority races in the next 3 weeks → Championship), but I pick.
5. **Generate workout** (main button): warm-up, the exercises in slot order (sets, reps or time, rest, one-line cue, watch link), estimated duration, and a one-sentence "why this today" that names the rule used (e.g. "Deep season, race day: plyos + isos only"). "Regenerate" swaps exercises within the same slots and session type. Save completed sessions to history.
6. **Week view**: last 7 days of runs and lifts, showing how many strength and plyo sessions I've done.

## Generation rules (the coach's system — put these in one clearly commented rules file)

### When to lift
- Run first, then lift. Only lift on Workout or Race days. On Easy/Long days, no main lift; offer an optional 10-min touch-up (session_type "touch-up": foot, calf, hip flexor work).
- Never generate a strength session if the next hard workout or race is less than 48h away; downgrade to Plyos + Isos.
- If I couldn't lift on a workout day, allow a lift the next morning only if the next hard run is 48h+ away.
- Max 2 strength sessions and 2 plyo sessions per rolling 7 days (count from history).

### My Thursday-race week (default)
- Early season: workout day = Full; race day = Full after the race.
- Deep season: workout day = Full; race day = Full at half volume, or Plyos + Isos.
- Championship: workout day = Plyos + Isos; race day = nothing, or a few isos.
- If the workout is Tuesday, show a warning that the lift is right at the 48h limit before Thursday.

### Other race days (if a race isn't on Thursday; '1st'/'2nd workout' = the two hard days before the race)
- Early: 1st = Full; 2nd = Full at half volume.
- Deep: 1st = Full; 2nd = Plyos + Isos.
- Championship: both = Plyos + Isos.
- Race day itself counts as a hard day; a lift after it is fine if the next hard workout is 48h+ away.

### Session types (use the exercise "slot" field)
- Full (~45 min max): A1 vertical plyo, A2 lateral plyo, B1 lower-body compound (3x3-5 @ RPE 7), C1 posterior chain, C2 calf/foot, D1 hip flexor, D2 abduction/adduction. In-season: 1-2 plyos + 4-5 strength moves, never more than 6. Off-season can use all 7 slots + 1 UPPER.
- Short (20 min, option when I say I'm short on time): drop jumps 3x5, squat 3x3-5 superset with calf raise 3x8-10, RDL 3x6.
- Plyos + Isos: 1-2 low/medium-intensity plyos, then 3-4 isometrics (overcoming: 3-5 s max pushes x5), including one calf/ankle.
- Return week (first week after a break, a toggle): yielding isometrics only, 20-45 s holds.
- Touch-up: 2-3 low-intensity foot/calf/hip flexor moves, ~10 min.

### Dosing
- Low sets, low reps, >70% effort, never to failure.
- Nordics max 3x3. Drop jumps: cue minimal ground contact; height isn't the goal.
- Rotate plyo categories (plyo_type: deep, pogo, single-leg-hop, lateral) across the week so each appears at least once.
- Keep the same exercise picks for 3-4 weeks before rotating: store a "current block" of picks per slot; regenerate swaps within the slot but prefers block picks.
- Extra lateral volume (e.g. monster walks) only off-season and early season.

## Deliverables
- Working app with a clean, simple UI designed for a phone screen.
- Unit tests for the rules engine: each Thursday-race phase case, the Tuesday 48h warning, other race days, the 48h downgrade, the weekly caps, easy/long days, and regenerate staying within rules.
- SETUP.md with exact steps I need to do myself: create a Strava API app at strava.com/settings/api (what to put for the callback domain locally and on Vercel), which env vars to set, and how to deploy to Vercel.
- A mock-data mode (no Strava needed) so I can try the app before setting up API keys.
- Commit in logical steps and push to the repo.
