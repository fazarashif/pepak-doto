import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { LOGIN_STATE_COOKIE, LOGIN_STATE_PATH } from "@/lib/auth/constants";
import { safeNextPath } from "@/lib/auth/redirect";
import { isAuthConfigured } from "@/lib/auth/session";
import { buildLoginUrl } from "@/lib/steam/openid";

export function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (!isAuthConfigured()) {
    return NextResponse.redirect(new URL("/signin?error=config", origin));
  }

  const state = randomBytes(16).toString("base64url");
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const returnTo = `${origin}/api/auth/steam/callback?state=${state}`;

  const response = NextResponse.redirect(buildLoginUrl(returnTo, origin));
  response.cookies.set(LOGIN_STATE_COOKIE, JSON.stringify({ state, next }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: LOGIN_STATE_PATH,
    maxAge: 10 * 60,
  });
  return response;
}
