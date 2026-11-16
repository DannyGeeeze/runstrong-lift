import { connection } from "next/server";
import { readTokens, stravaConfig } from "@/lib/server/strava-session";

export async function GET() {
  await connection(); // always runtime: env and cookies decide the answer
  const configured = !!stravaConfig();
  const tokens = configured ? await readTokens() : null;
  return Response.json(
    { configured, connected: !!tokens, athlete: tokens?.athlete },
    { headers: { "Cache-Control": "no-store" } },
  );
}
