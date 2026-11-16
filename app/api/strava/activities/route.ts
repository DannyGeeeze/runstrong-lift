import { connection } from "next/server";
import { clearTokens, freshTokens } from "@/lib/server/strava-session";
import { isRun, toRun, type StravaActivity } from "@/lib/strava";

const DAYS = 14;

export async function GET() {
  await connection();
  let tokens;
  try {
    tokens = await freshTokens();
  } catch {
    await clearTokens();
    return Response.json({ error: "Strava session expired. Connect again in Settings." }, { status: 401 });
  }
  if (!tokens) return Response.json({ error: "Not connected to Strava." }, { status: 401 });

  // A day of slack so "14 days ago" in any timezone is covered.
  const after = Math.floor(Date.now() / 1000) - (DAYS + 1) * 86400;
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
    { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" },
  );
  if (res.status === 401) {
    await clearTokens();
    return Response.json({ error: "Strava access was revoked. Connect again in Settings." }, { status: 401 });
  }
  if (res.status === 429) {
    return Response.json({ error: "Strava rate limit hit. Try again in a few minutes." }, { status: 429 });
  }
  if (!res.ok) return Response.json({ error: `Strava error (${res.status})` }, { status: 502 });

  const activities = (await res.json()) as StravaActivity[];
  const runs = activities.filter(isRun).map(toRun);
  return Response.json({ runs }, { headers: { "Cache-Control": "no-store" } });
}
