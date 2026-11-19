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
5. ~~**The race-day lift for non-Thursday races** follows the same row as a Thursday race day. A lift after a race is allowed only if the next hard day is at least 48h away.~~ *Replaced by 73: no lifts on race days.*
6. ~~**Deep season, Thursday race day** defaults to *Full at half volume*. Settings has a switch for *Plyos + Isos*.~~ *Replaced by 73: no lifts on race days.*
7. ~~**Championship race day** gives an optional "a few isos" session (2 overcoming isos, one of them calf/ankle). It uses the bank's `taper` session type, which the brief doesn't mention.~~ *Replaced by 73: no lifts on race days.*
8. **Off-season with a race on the calendar** follows the Early season race-week rows, because the coach's tables don't cover off-season races. Off-season workout days get the full 7 slots + 1 UPPER.
9. **A Championship workout with no race close by** is Plyos + Isos. In other phases it's Full.
10. **Weekly caps run in order.** With 2 strength sessions already in the last 7 days, the session becomes Plyos + Isos. With 2 plyo sessions, plyos are removed. If both caps are hit, you get isos only. "Rolling 7 days" means today plus the 6 days before it.
11. ~~**Return week** turns any lift day (and the easy-day touch-up) into yielding isos.~~ Replaced by 75-78.
12. **Short on time** only applies when a Full session with strength is allowed. It never overrides the 48h rule or the weekly caps.
13. **Next-morning catch-up** shows on a non-lift day when yesterday was a Workout day with nothing logged, and only if the next hard day is at least 2 calendar days away.
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
    - Answers also fill in phase, tune-up day, workout days and the break stage (75) in Settings. A goal race is added as an A race.
38. **Every profile filter relaxes rather than leaving a slot empty.** First it drops the experience filter, then the equipment filter. The coach's Short template uses its own picks when they fit, and otherwise the nearest Full option for that slot.
39. **The profile only changes which exercises fill a slot.** The coach's timing rules (48h, weekly caps, phase tables) are never changed by onboarding answers.
40. **Rep text cleanup:** where a library entry repeats its set count inside reps (e.g. "2-3 x 20-45 s hold"), the count is dropped from reps, since `sets` already holds it.
41. **Pull-up bar equipment:** "Kettlebell Hip Flexor Iso In Deadhang" now needs `kettlebell, pull-up bar`, and "Chin Up" needs `pull-up bar` (it was listed as bodyweight). Neither shows up for Home or Bodyweight setups.
42. **Events are multi-select** (`profile.events`). Profiles saved with the old single `event` field are converted automatically.
43. **Minimal text:** onboarding shows only the question and its options. Helper captions are gone from Today, Settings and Races too. "Why today" and warnings stay.
44. **Test mode** (Settings → Test mode) loads a mid-track-season scenario into a separate storage slot. That scenario is Deep phase, a meet every Thursday, league champs as the A race in 4 weeks, last meet's lift in history, and demo runs. Exit throws the test copy away, and your real data is never touched.

## In-app exercise demos (`lib/demo`, `components/ExerciseDemo.tsx`)

45. **No leaving the app to see an exercise.** The brief's "watch" link is replaced by a **Demo** button that opens inside the exercise card.
46. **A direct video link plays in the app.** If an exercise's `video_url` is a YouTube, YouTube Shorts, Instagram post/reel or Vimeo link, the Demo plays it with that site's official embed player (YouTube uses the privacy-enhanced youtube-nocookie domain). The coach's category-page links aren't videos, so they fall through to the animation.
47. **Everything else gets a built-in animation.** There are 17 movement patterns: squat, hinge, split squat, calf raise, tib raise, pogo, hop, skip, jump, drop jump, lateral bound, band walk, knee drive, bridge, Nordic, Copenhagen and row. They're drawn with a small stick-figure rig whose knees are solved automatically, so feet stay planted. Exercises are matched by name keywords first and then by slot, so new JSON entries get an animation with no code changes. Isometric exercises show the held position with a "Hold" tag. Reduced-motion settings show a still frame.
48. **The animations are original drawings.** No video or artwork is copied from the coach's site. Showing his videos in the app only happens through official embeds of links you add.

## Home screen and live workouts

49. **App-shell layout.** The page never scrolls; only the content area between the top and the tab bar does, and only when its content is taller than the screen. The tab bar is part of the layout instead of floating over it. Rubber-band bounce is off. This, plus the web app manifest and icons (`app/manifest.ts`, `public/icon-*.png`, `app/apple-icon.png`), makes "Add to Home Screen" open full-screen like an app. The status bar uses `default`, which follows the light/dark theme color on newer iPhones.
50. **Live workout** (`lib/live.ts`, `components/LiveWorkout.tsx`) goes warm-up → every set of every exercise → rests between sets.
    - **Untimed sets** show the reps and a **Done** button.
    - **Timed sets** (holds, pushes) do a 3-2-1 countdown, then run a ring timer. Holds use the middle of the range rounded down (20–45 s → 30 s). Short pushes use the top of the range (3–5 s → 5 s). One-sided holds run left, then a 5 s switch, then right.
    - **Rests start on their own**, using the exercise's rest (ranges use the middle), with +15 s and Skip. There's at least 45 s between exercises. Supersets alternate both exercises before resting.
    - **Beeps** sound on the last 3 seconds and at zero, with vibration on Android. The screen is kept awake where the browser allows it.
    - **Timers use real timestamps**, so locking the phone doesn't throw them off.
    - **Finishing** saves only the exercises you actually did, the same as Mark complete with those ticked.
51. **Player design** (direction from the user: guided-workout feel, own design, no third-party branding or assets).
    - **Layout:** always-dark full-screen player. The move's demo fills the top ~45% of the screen. Below it: "Set X of Y", the move name, and the reps or time in very large type.
    - **Progress bar:** one segment per exercise (plus a short warm-up segment), with elapsed time next to it.
    - **Controls:** a thumb-reachable bottom row of Back, a big center button, and Skip. The center button is Start, Done, Pause or Resume depending on the step.
    - **Pause** freezes the active timer and the workout clock.
    - **Finish screen** shows time, sets done and moves done before saving.
52. **Hands-free timed sets.** Timed holds and pushes start a 3-2-1 countdown by themselves as soon as you reach them, then run and move on automatically. Rests do the same. Rep-based sets wait for you to tap **Done**. The only tap needed to begin is **Start** after the warm-up, which also unlocks sound on phones.

## Weight logging (`lib/weights.ts`)

53. **Which moves get a weight:** a move counts as loaded when its equipment includes a barbell, dumbbell, kettlebell, trap/safety bar, landmine, plate, cable, leg press, belt squat, sled, machine, med ball or weight vest. That's 135 of the exercises. "Bodyweight" deliberately doesn't count.
54. **Logging:** in the live workout, loaded rep sets show a −5 / weight / +5 stepper above Done. You can also tap the number to type any weight. It's pre-filled with this session's previous set, otherwise last session's same set, otherwise last session's top set. Weights are saved in pounds with the session in lift history (`LiftLog.weights`), so export/import carries them.
55. **Showing it:** exercise cards and the "Up next" card show "Last time: 95 lb" (or a range across sets). The finish screen calls out a 🏆 new best when you beat your heaviest logged weight for a move; the first time you log a move isn't counted as a best.

## iPhone app + lock-screen Live Activity (`ios/`, `capacitor.config.ts`)

56. **A thin native shell.** The iPhone app is a Capacitor shell that loads the live site (`server.url`), so web deploys show up in the app without reinstalling. Strava sign-in stays inside the app (`allowNavigation`). Minimum iOS is 16.2, the first version with Live Activity content updates. The app is portrait only.
57. **The Live Activity** is a WidgetKit extension (`ios/App/RSLiftWidget`) drawing `WorkoutActivityAttributes` (`ios/App/Shared`).
    - **Lock-screen card:** the move, "Set 2 of 3", a big readout (reps, or a countdown), a progress bar and "Up next".
    - **Dynamic Island:** compact and expanded views.
    - **Countdowns** use `Text(timerInterval:)`, so they keep ticking on the lock screen while the app is asleep.
58. **The bridge.** The web app drives the Live Activity through a local Capacitor plugin (`LiveActivityPlugin.swift`, registered in `MainViewController.swift`; JS in `lib/native.ts`). The live workout sends an update only when the step, the timer or the pause state changes. It ends the activity on exit, and on finish leaves a "Workout complete" card up for 5 minutes. In a browser every call does nothing.
59. **The widget target** is added to the Xcode project by `scripts/ios-add-live-activity.rb`, which can be re-run safely, rather than by hand in Xcode.

## Easy-day upper body (`lib/rules/sessions.ts`)

60. **Easy and long days default to an upper-body lift.** In the 7 days before an A race they default to the touch-up instead, and the reason says so ("State (A) in 4 days, so no upper-body lift"). B and C races don't change it. The runner can still switch between the two. Workout, race and rest days are unchanged.
61. **No core or hip sessions.** The team already does core and hip work at practice, so the app doesn't add them. (Core and Mobility options were built and then removed for this reason. A "suggest whatever you haven't done this week" rotation was also removed once upper body became the default.)
62. **Upper body doesn't load the legs,** so it doesn't count toward the weekly 2 strength + 2 plyo caps and doesn't affect the 48h rule. In a week off (75) both easy-day choices become the week-off isos; in a ramp week (76) upper body is unchanged.
63. **Upper body is split by body part (~20 min, 4 moves each):**
    - Back & biceps: a vertical pull (pull-up or pulldown), a row, a curl and a shoulder-blade move.
    - Chest & triceps: two presses or push-ups, a triceps move and a serratus move.
    - Shoulders: an overhead press, a lateral raise, rotator-cuff work and a crawl or waiter carry.
    Main lifts are 3 sets, leaving 2-3 reps in the tank. (This replaced one mixed pull/push/shoulder/carry session.)
67. **Body parts rotate from history.** Each upper-body log saves its body part. The next one is whichever was done longest ago, never-done first, in the order back, chest, shoulders. Today's own log is ignored, so the pick doesn't jump right after you finish. The reason line says why ("back & biceps is next, last done 6 days ago"). The runner can tap a different body part. The Week page shows which ones were done in the last 7 days. Logs from before this change have no body part and are ignored.
64. **New exercises,** tagged `"source": "app"` since they aren't from the coach's library: push-ups, band rows and band pull-aparts; then curls (dumbbell, hammer, band), triceps extensions (dumbbell, band), close-grip push-ups, lateral raises (dumbbell, band), a band pulldown and a band overhead press. Every body-part day works with minimal equipment. The arm and shoulder add-ons are tagged `upper` only, so Full sessions never pick them.
65. **Equipment fixes:** pull-ups, scap pull-ups and dead hangs now need a pull-up bar. Single-arm and contralateral carries need dumbbells or a kettlebell. Z Press needs dumbbells or a barbell.
66. **New animations:** overhead press, push-up, forearm plank, curl, overhead triceps extension, lateral raise (front view) and pulldown (front view). Upper-body moves pick the closest one instead of always showing a row.

## Recovery: compression boots and sauna (`lib/rules/recovery.ts`)

68. **One suggestion a day, under the lift.** Stretching is assumed daily, so it isn't tracked. The Today screen suggests boots, sauna or nothing, with a one-line reason. The runner can switch, skip, or log both on the same day.
69. **Boots after hard days.** Workout, race or long run → boots. The day before any race → boots and no sauna (sauna dehydrates and can leave you flat). If a hard day had no boots, the next day suggests them, like the lift catch-up.
70. **Sauna on easy days,** for heat adaptation on the day with the least stress to stack on. Limits: max 3 in 7 days, not two days in a row, none the day before any race, none in the 2 days before an A or B race. Picking sauna anyway shows a heads-up with the reason. Every sauna shows the safety note (10-15 min, water before and after, get out if dizzy).
71. **Rest days suggest nothing:** either is fine.
72. **Settings → Recovery** says which ones the runner has (both on by default). Only those are suggested. Logged sessions show on the Week page (Boots × n, Sauna n/3) and can be deleted there.

## Race days and long runs

73. **Never lift on race days.** The runner's rule, stricter than the coach's (who lifts after Thursday races). Race days are always "no lift", in every phase. There's no catch-up lift on a race morning, and none the morning after a race. The "Deep season, race day lift" setting is gone. Race days still count as hard days for the 48h rule, and Recovery suggests boots.
74. **Long-run days: optional long-run isos (~8 min).** The coach's system says nothing about long-run days. The legs are already tired from the long run, so the app adds almost no load: 3 easy holds (yielding isos, calf/ankle first), 2 x 30 s, 30 s rest. Holds are tendon-friendly and cost very little. Skipping it is fine. Upper body and the touch-up are now easy days only. Recovery suggests compression boots after a long run.

## Time off: Break / return (`lib/rules/rules.ts`, `lib/rules/sessions.ts`)

75. **Week off.** Settings → Break / return → Week off. No hard runs are expected, so the hard-day rules (race-week roles, phase tables, the 48h rule, the weekly caps) don't apply. Any day except a race day can have one optional session, spaced every 2-3 days: if the last lift was yesterday, today is rest and the reason says when the next one is. The session is about 15 minutes of yielding isos only: one Achilles/calf iso, one hip/hamstring iso (posterior chain, hip flexor or adductor slot) and one more, 20-45 s holds, 3 sets (2 when done one side at a time). Easy-day upper body and the touch-up are replaced by it. No next-morning catch-up. Never on race days (73).
76. **Ramp week (the week after).** The normal rules decide when to lift and what kind of session it is. Full and Short sessions are then built lighter: no high-intensity moves at all (so plyos are low/medium and no Nordics, which can't be done for 8-12), and every loaded move is 2-3 sets of 8-12 @ RPE 5-6. Plyos and isos keep their usual dosing. Upper body, Plyos + Isos, and the 48h rule and caps are unchanged.
77. **Normal** is the regular rules.
78. **Moving on is suggested, not automatic.** Each stage records the day it started. After 7 days in Week off the app suggests Ramp week; after 7 days in Ramp week it suggests Normal. The suggestion shows on Today and in Settings with a one-tap switch. The runner can pick any stage at any time or change the start date. The old "Return week" toggle carries over as Week off starting the day the new version first loads.

