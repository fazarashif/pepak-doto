import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_STATE_COOKIE, LOGIN_STATE_PATH } from "@/lib/auth/constants";
import { safeNextPath } from "@/lib/auth/redirect";
import { createSession } from "@/lib/auth/session";
import { upsertUserFromSteam } from "@/lib/auth/users";
import { checkAssertion, verifyWithSteam } from "@/lib/steam/openid";
import { loadSteamProfile } from "@/lib/steam/profile";

function fail(origin: string, error: string) {
  const response = NextResponse.redirect(new URL(`/signin?error=${error}`, origin));
  response.cookies.delete({ name: LOGIN_STATE_COOKIE, path: LOGIN_STATE_PATH });
  return response;
}

export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;

  let saved: { state?: string; next?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(LOGIN_STATE_COOKIE)?.value ?? "{}");
  } catch {
    // cookie rusak, diperlakukan sama dengan tidak ada
  }
  const state = searchParams.get("state");
  if (!state || state !== saved.state) return fail(origin, "expired");

  const expectedReturnTo = `${origin}/api/auth/steam/callback?state=${state}`;
  const assertion = checkAssertion(searchParams, expectedReturnTo);
  if (!assertion.ok) return fail(origin, "invalid");

  try {
    if (!(await verifyWithSteam(searchParams))) return fail(origin, "invalid");
  } catch {
    return fail(origin, "steam");
  }

  try {
    const profile = await loadSteamProfile(assertion.steamId);
    const user = await upsertUserFromSteam(profile);
    await createSession(user);
  } catch (err) {
    console.error("[auth] sign-in failed", err);
    return fail(origin, "server");
  }

  const response = NextResponse.redirect(new URL(safeNextPath(saved.next), origin));
  response.cookies.delete({ name: LOGIN_STATE_COOKIE, path: LOGIN_STATE_PATH });
  return response;
}
