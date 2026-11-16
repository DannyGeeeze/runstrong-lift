# Decisions

These are choices I made where the brief left room. Each one says where it lives in the code, so it's easy to change.

## Rules (`lib/rules/rules.ts`)

1. **48h is counted in calendar days.** You run first and lift after, so a hard day **1 day away** counts as under 48h (strength becomes Plyos + Isos), and **2 days away** counts as "right at the limit" (allowed, with a warning). This is why a Tuesday tune-up before a Thursday race is allowed but warned about.
2. **Where future hard days come from:**
   - every race on your schedule;
   - in a Thursday-race week, the tune-up day from Settings (Mon/Tue);
   - in a week with a race on another day, the race date minus 4 days ("1st workout") and minus 2 days ("2nd workout");
   - in a week with no race, the workout days in Settings (default Tue + Fri);
   - any future date you mark as Workout or Race.
3. **A workout earlier in a Thursday-race week counts as the tune-up**, even if it falls on a different day from the tune-up setting. That planned tune-up day then stops counting as another hard day.
4. **1st vs 2nd workout before a non-Thursday race** depends on whether another planned hard day sits between today and the race.
5. **The race-day lift for non-Thursday races** follows the same row as a Thursday race day. A lift after a race is allowed only if the next hard day is at least 48h away.
6. **Deep season, Thursday race day** defaults to *Full at half volume*. Settings has a switch for *Plyos + Isos*.
7. **Championship race day** gives an optional "a few isos" session (2 overcoming isos, one of them calf/ankle). It uses the bank's `taper` session type, which the brief doesn't mention.
8. **Off-season with a race on the calendar** follows the Early season race-week rows, because the coach's tables don't cover off-season races. Off-season workout days get the full 7 slots + 1 UPPER.
9. **A Championship workout with no race close by** is Plyos + Isos. In other phases it's Full.
10. **Weekly caps run in order.** With 2 strength sessions already in the last 7 days, the session becomes Plyos + Isos. With 2 plyo sessions, plyos are removed. If both caps are hit, you get isos only. "Rolling 7 days" means today plus the 6 days before it.
11. **Return week** turns any lift day (and the easy-day touch-up) into yielding isos.
12. **Short on time** only applies when a Full session with strength is allowed. It never overrides the 48h rule or the weekly caps.
13. **Next-morning catch-up** shows on a non-lift day when yesterday was a Workout or Race day with nothing logged, and only if the next hard day is at least 2 calendar days away.
14. **The phase suggestion** works like this: an A race within 21 days suggests Championship. Races both in the last 6 weeks and in the next 3 suggest Deep. A race within 10 weeks suggests Early. Anything else suggests Off-season. You still pick the phase yourself.

## Sessions and dosing (`lib/rules/sessions.ts`)

15. **The in-season Full session** is A1 + B1, C1, C2, D1, D2 (6 moves). If no lateral plyo has been done in the last 7 days, A2 is added and D2 is dropped, so it stays at 6. POWER and MOBILITY (when turned on) count toward the 6. When there are too many moves, D2 goes first, then MOBILITY, D1, POWER.
16. **UPPER only appears in off-season Full sessions** (at most 1).
17. **Half volume** halves the sets, rounding to the nearest whole set (3 → 2), with a minimum of 1.
18. **The ~45 min cap on Full**: if the estimate is over 45 min, accessory sets come down by one (D2, D1, C2, C1, then A2) until it fits.
19. **Overcoming isos** are 5 x 3-5 s max pushes with 15-20 s between. **Yielding/hold isos** are 3 x 20-45 s.
20. **Plyos + Isos** uses 1 plyo, plus an A2 when lateral is missing this week. Plyos must be low/med intensity. It then adds 3 isos (4 if plyos were removed): the first is calf/ankle, overcoming is preferred, and the slots are spread out.
21. **Touch-up** is C2 (foot), D1 (hip flexor) and C2 (calf), using low-intensity moves where the bank has them.
22. **Plyo rotation** puts plyos whose `plyo_type` (deep, pogo, single-leg-hop, lateral) hasn't been done in the last 7 days first in line. Other types (rhythm, loaded, oscillation, other) can still be picked but don't count toward the rotation.
23. **Extra lateral volume** (e.g. monster walks) is controlled by an exercise's optional `phases` list in the JSON. An exercise with no `phases` is allowed in every phase.

## Exercise bank (`lib/exercises.ts`)

24. **Three ids appear in both `featured` and `library`** (`trap-bar-deadlift`, `copenhagen`, `monster-walk`). The featured entry wins.
25. **No featured exercise has a `video_url`**, and every library `video_url` is a category browse page on the coach's site. Featured exercises link to the browse page for their slot (e.g. A1 → plyometrics).
26. **Library entries have no `cue` or `rest`**, so they get sensible defaults for their slot.
27. **Isometric type**: the `isometric` field is used when present. Otherwise the app reads it from the name ("overcoming", "yielding"). Other isos with "3-5 s" reps count as overcoming, and the rest count as holds.

## Selection and blocks (`lib/rules/select.ts`)

28. **Picking is deterministic.** Each slot's candidates are put in order (block picks first, then roughly 70/30 featured/library), with a random seed based on the date and slot. The first Generate takes the first candidate, and each Regenerate takes the next. This keeps Regenerate in the same slot and session type, and makes the tests repeatable.
29. **The block** remembers up to 2 picks per slot from completed sessions and rotates after 28 days. Settings has **Start new block now** if you want to rotate sooner.

## App

30. **Strava tokens** live in an AES-256-GCM encrypted, httpOnly cookie (key derived from `SESSION_SECRET`), so there's no database. Tokens refresh automatically when they're within 5 minutes of expiring.
31. **Day type priority** is: your override, then a race on the schedule, then the hardest Strava run that day, then rest. On a day with two runs, the harder one wins.
32. **Strava `workout_type` 0 (default) maps to Easy.** Use the chips to correct it.
33. **Units are miles and min/mi.**
34. **Demo data** turns on automatically when Strava keys aren't set, and there's a toggle in Settings once they are.
35. **Mark complete** saves the exercises you ticked, or all of them if you ticked none. Block picks come from the whole session.

## Onboarding and runner profile (`lib/profile.ts`, `app/welcome`)

36. **First launch opens onboarding** (`/welcome`). It asks 10 short questions: name, event, weekly miles, lifting experience, equipment, goals (up to 2), trouble spots, week layout, season and goal race, and whether you're coming back from a break. Settings → **Redo setup** runs it again with your answers pre-filled.
37. **What the answers change:**
    - **Equipment:** exercises you can't do with your gear are skipped. "Home" means dumbbells, kettlebells, bands, a box or bench, sliders and a med ball. "Just me" means bodyweight, a band, a box or bench, and a foam roller. Where an exercise lists several items, you need all of them; where it lists alternatives ("or"), any one will do.
    - **Experience "new":** high-intensity exercises and Nordics are skipped.
    - **Trouble spots:** matching exercises go to the front of their slot. Matching is done by exercise name and id.
    - **Goals "kick" or "economy":** Full sessions always get A2, so 2 plyos, still capped at 6 moves.
    - **Goal "healthy":** the easy-day touch-up is labeled "Recommended" on Today.
    - **20-minute sessions:** "Short on time" starts switched on.
    - Answers also fill in phase, tune-up day, workout days and return week in Settings. A goal race is added as an A race.
38. **Every profile filter relaxes rather than leaving a slot empty.** First it drops the experience filter, then the equipment filter. The coach's Short template uses its own picks when they fit, and otherwise the nearest Full option for that slot.
39. **The profile only changes which exercises fill a slot.** The coach's timing rules (48h, weekly caps, phase tables) are never changed by onboarding answers.
40. **Rep text cleanup:** where a library entry repeats its set count inside reps (e.g. "2-3 x 20-45 s hold"), the count is dropped from reps, since `sets` already holds it.
