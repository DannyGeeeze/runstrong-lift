import { randomBytes } from "node:crypto";
import { originFor, setState, stravaConfig } from "@/lib/server/strava-session";

export async function GET(request: Request) {
  const cfg = stravaConfig();
  if (!cfg) {
    return Response.json({ error: "Strava isn't configured. See SETUP.md." }, { status: 500 });
  }
  const state = randomBytes(16).toString("hex");
  await setState(state);
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", cfg.clientId);
  url.searchParams.set("redirect_uri", `${originFor(request)}/api/strava/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "activity:read_all");
  url.searchParams.set("state", state);
  return Response.redirect(url, 302);
}
