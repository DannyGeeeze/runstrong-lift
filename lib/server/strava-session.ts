// Server-only: Strava tokens live in an encrypted, httpOnly cookie. The client secret and
// tokens never reach browser JavaScript.

import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE = "rsl_strava";
export const STATE_COOKIE = "rsl_oauth_state";
const MAX_AGE = 60 * 60 * 24 * 180; // 180 days; the refresh token keeps it alive

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: string;
}

export function stravaConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const secret = process.env.SESSION_SECRET;
  if (!clientId || !clientSecret || !secret) return null;
  return { clientId, clientSecret, secret };
}

function key(secret: string) {
  return createHash("sha256").update(secret).digest();
}

export function seal(data: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const enc = Buffer.concat([cipher.update(JSON.stringify(data), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64url");
}

export function unseal<T>(value: string, secret: string): T | null {
  try {
    const buf = Buffer.from(value, "base64url");
    const decipher = createDecipheriv("aes-256-gcm", key(secret), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    const dec = Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return null;
  }
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function readTokens(): Promise<StravaTokens | null> {
  const cfg = stravaConfig();
  if (!cfg) return null;
  const raw = (await cookies()).get(COOKIE)?.value;
  return raw ? unseal<StravaTokens>(raw, cfg.secret) : null;
}

export async function writeTokens(tokens: StravaTokens) {
  const cfg = stravaConfig();
  if (!cfg) throw new Error("Strava is not configured");
  (await cookies()).set(COOKIE, seal(tokens, cfg.secret), { ...cookieOptions, maxAge: MAX_AGE });
}

export async function clearTokens() {
  (await cookies()).delete(COOKIE);
}

export async function setState(state: string) {
  (await cookies()).set(STATE_COOKIE, state, { ...cookieOptions, maxAge: 600 });
}

export async function takeState(): Promise<string | undefined> {
  const store = await cookies();
  const v = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  return v;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { firstname?: string; lastname?: string };
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const cfg = stravaConfig()!;
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...body }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Strava token request failed (${res.status})`);
  return res.json();
}

export async function exchangeCode(code: string): Promise<StravaTokens> {
  const t = await tokenRequest({ code, grant_type: "authorization_code" });
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    expires_at: t.expires_at,
    athlete: t.athlete?.firstname,
  };
}

/** Returns valid tokens, refreshing (and re-saving the cookie) if they expire within 5 min. */
export async function freshTokens(): Promise<StravaTokens | null> {
  const tokens = await readTokens();
  if (!tokens) return null;
  if (tokens.expires_at - 300 > Date.now() / 1000) return tokens;
  const t = await tokenRequest({ refresh_token: tokens.refresh_token, grant_type: "refresh_token" });
  const next = { ...tokens, access_token: t.access_token, refresh_token: t.refresh_token, expires_at: t.expires_at };
  await writeTokens(next);
  return next;
}

/** Public origin for the OAuth redirect. APP_URL wins when set (e.g. a custom domain). */
export function originFor(request: Request): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
}
