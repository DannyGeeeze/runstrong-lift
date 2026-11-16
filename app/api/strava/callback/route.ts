import { exchangeCode, originFor, takeState, writeTokens } from "@/lib/server/strava-session";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = originFor(request);
  const fail = (reason: string) => Response.redirect(`${origin}/settings?strava=${encodeURIComponent(reason)}`, 302);

  const expected = await takeState();
  if (url.searchParams.get("error")) return fail("denied");
  if (!expected || url.searchParams.get("state") !== expected) return fail("state");

  const code = url.searchParams.get("code");
  const scope = url.searchParams.get("scope") ?? "";
  if (!code) return fail("nocode");
  if (!scope.includes("activity:read_all")) return fail("scope");

  try {
    await writeTokens(await exchangeCode(code));
  } catch {
    return fail("token");
  }
  return Response.redirect(`${origin}/`, 302);
}
