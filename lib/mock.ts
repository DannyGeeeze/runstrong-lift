// Mock-data mode: realistic runs for a ~55 mi/week HS distance runner, no Strava needed.

import { addDays, dayInWeek, weekdayOf } from "./dates";
import { METERS_PER_MILE } from "./strava";
import type { Race, Run, RunType, Weekday } from "./types";

// A Thursday-race week: Tue tune-up, Thu race, Sat long run, Sun off.
const WEEK: Record<Weekday, { type: RunType; miles: number; pace: number; hr?: number; name: string } | null> = {
  mon: { type: "easy", miles: 7, pace: 7.75, hr: 146, name: "Easy + strides" },
  tue: { type: "workout", miles: 8, pace: 6.6, hr: 168, name: "6 x 1K @ 5K pace" },
  wed: { type: "easy", miles: 8, pace: 7.8, hr: 144, name: "Easy run" },
  thu: { type: "race", miles: 3.1, pace: 5.45, hr: 186, name: "Dual meet 5K" },
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
