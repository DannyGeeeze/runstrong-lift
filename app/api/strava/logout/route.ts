import { clearTokens } from "@/lib/server/strava-session";

export async function POST() {
  await clearTokens();
  return Response.json({ ok: true });
}
