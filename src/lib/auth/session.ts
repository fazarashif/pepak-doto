import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { getDb, schema } from "@/lib/db";
import type { User } from "@/lib/db/schema";

export const SESSION_COOKIE = "pd_session";
const SESSION_DAYS = 30;

function secretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set (at least 32 characters)");
  }
  return new TextEncoder().encode(secret);
}

export function isAuthConfigured() {
  return (process.env.SESSION_SECRET?.length ?? 0) >= 32;
}

export async function createSession(user: Pick<User, "id" | "steamId">) {
  const token = await new SignJWT({ steamId: user.steamId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

async function readSession(): Promise<{ userId: string; steamId: string } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || !isAuthConfigured()) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (!payload.sub || typeof payload.steamId !== "string") return null;
    return { userId: payload.sub, steamId: payload.steamId };
  } catch {
    return null;
  }
}

/** User yang sedang login, atau null. Di-memo per request. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const session = await readSession();
  if (!session) return null;
  try {
    const db = await getDb();
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, session.userId))
      .limit(1);
    // Akun yang sudah dihapus tidak boleh tetap login lewat cookie lama.
    return user && user.steamId === session.steamId ? user : null;
  } catch (err) {
    console.error("[auth] failed to load user", err);
    return null;
  }
});

export function isAdmin(user: Pick<User, "steamId"> | null) {
  if (!user) return false;
  const admins = (process.env.ADMIN_STEAM_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return admins.includes(user.steamId);
}
