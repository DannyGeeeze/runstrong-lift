// Mock-data mode: realistic runs for a ~55 mi/week HS distance runner, no Strava needed.

import { addDays, dayInWeek, weekdayOf } from "./dates";
import { METERS_PER_MILE } from "./strava";
import type { AppData } from "./storage";
import type { LiftLog, Race, Run, RunType, Weekday } from "./types";

// A Thursday-race week: Tue tune-up, Thu race, Sat long run, Sun off.
const WEEK: Record<Weekday, { type: RunType; miles: number; pace: number; hr?: number; name: string } | null> = {
  mon: { type: "easy", miles: 7, pace: 7.75, hr: 146, name: "Easy + strides" },
  tue: { type: "workout", miles: 8, pace: 6.6, hr: 168, name: "6 x 1K @ 5K pace" },
  wed: { type: "easy", miles: 8, pace: 7.8, hr: 144, name: "Easy run" },
  thu: { type: "race", miles: 3.1, pace: 5.45, hr: 186, name: "Meet" },
  fri: { type: "easy", miles: 6, pace: 8.0, hr: 140, name: "Shakeout" },
  sat: { type: "long", miles: 13, pace: 7.5, hr: 150, name: "Long run" },
  sun: { type: "easy", miles: 6, pace: 8.1, hr: 138, name: "Recovery run" },
};

const STRAVA_TYPE: Record<RunType, number> = { easy: 0, race: 1, long: 2, workout: 3, rest: 0 };

export function mockRuns(today: string, days = 14): Run[] {
  const runs: Run[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const plan = WEEK[weekdayOf(date)];
    if (!plan) continue;
    const distanceM = plan.miles * METERS_PER_MILE;
    const movingTimeS = Math.round(plan.miles * plan.pace * 60);
    runs.push({
      id: `mock-${date}`,
      date,
      startLocal: `${date}T15:30:00Z`,
      name: plan.name,
      distanceM,
      movingTimeS,
      avgHr: plan.hr,
      stravaWorkoutType: STRAVA_TYPE[plan.type],
      type: plan.type,
    });
    // Race days also have a warm-up run.
    if (plan.type === "race") {
      runs.push({
        id: `mock-${date}-wu`,
        date,
        startLocal: `${date}T15:00:00Z`,
        name: "Warm-up",
        distanceM: 2 * METERS_PER_MILE,
        movingTimeS: 2 * 8 * 60,
        avgHr: 135,
        stravaWorkoutType: 0,
        type: "easy",
      });
    }
  }
  return runs;
}

/** Sample season: the next few Thursdays, ending with an A race. */
export function sampleRaces(today: string): Race[] {
  let thu = dayInWeek(today, "thu");
  if (thu < today) thu = addDays(thu, 7);
  const names = ["Dual meet", "County invitational", "League meet", "League championship"];
  return names.map((name, i) => ({
    id: `sample-${i}`,
    date: addDays(thu, i * 7 + (i === 3 ? 7 : 0)),
    name,
    distance: "5K",
    priority: i === 3 ? "A" : i === 1 ? "B" : "C",
  }));
}

// ---------------------------------------------------------------------------
// Test scenario: middle of track season
// ---------------------------------------------------------------------------

function nextOnOrAfter(date: string, day: Weekday) {
  const d = dayInWeek(date, day);
  return d < date ? addDays(d, 7) : d;
}

/**
 * A copy of the runner's setup dropped into the middle of track season:
 * Deep phase, a meet every Thursday (three behind, three ahead), league
 * champs as the A race in four weeks, and last meet's lift in history.
 * Demo runs are used so nothing depends on real Strava activity.
 */
export function trackSeasonScenario(today: string, real: AppData): AppData {
  const nextThu = nextOnOrAfter(addDays(today, 1), "thu");
  const races: Race[] = [
    ...[-3, -2, -1].map((w, i) => ({
      id: `track-past-${i}`,
      date: addDays(nextThu, w * 7),
      name: ["Tri meet", "Relays", "Dual meet"][i],
      distance: i % 2 ? "3200m" : "1600m",
      priority: "C" as const,
    })),
    { id: "track-1", date: nextThu, name: "Dual meet", distance: "1600m", priority: "C" },
    { id: "track-2", date: addDays(nextThu, 7), name: "County invitational", distance: "3200m", priority: "B" },
    { id: "track-3", date: addDays(nextThu, 14), name: "League dual", distance: "1600m", priority: "C" },
    { id: "track-champs", date: addDays(nextThu, 28), name: "League championships", distance: "3200m", priority: "A" },
  ];

  // Last meet's race-day lift only, so this week's tune-up isn't capped.
  const lastThu = addDays(nextThu, -7);
  const lastWeek: LiftLog[] = [
    { id: "track-lift-2", date: lastThu, session: "full", volume: "half", exerciseIds: [], hadStrength: true, hadPlyo: true, plyoTypes: ["single-leg-hop"] },
  ];
  const history = lastWeek.filter((h) => h.date < today && h.date >= addDays(today, -6));

  const base = real.profile;
  return {
    version: 1,
    settings: { ...real.settings, phase: "deep", returnWeek: false, mockMode: true },
    races,
    history,
    recovery: [],
    block: null,
    overrides: {},
    profile: base
      ? { ...base, events: ["distance"], raceDay: "thu" }
      : {
          name: "",
          events: ["distance"],
          weeklyMiles: 45,
          experience: "some",
          equipment: "gym",
          goals: ["kick"],
          troubleSpots: [],
          sessionMinutes: 45,
          raceDay: "thu",
          completedAt: today,
        },
    testMode: true,
  };
}
