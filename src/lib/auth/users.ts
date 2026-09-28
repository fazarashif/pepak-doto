import "server-only";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { SteamProfile } from "@/lib/steam/profile";

export async function upsertUserFromSteam(profile: SteamProfile) {
  const db = await getDb();
  const values = {
    steamId: profile.steamId,
    accountId: profile.accountId,
    personaName: profile.personaName,
    avatarUrl: profile.avatarUrl,
    profileUrl: profile.profileUrl,
    rankTier: profile.rankTier,
  };
  const [user] = await db
    .insert(schema.users)
    .values(values)
    .onConflictDoUpdate({
      target: schema.users.steamId,
      set: { ...values, lastLoginAt: sql`now()` },
    })
    .returning();
  return user;
}

/** Hapus user beserta datanya. Target latihan ikut terhapus lewat foreign key. */
export async function deleteUser(userId: string) {
  const db = await getDb();
  const [user] = await db
    .select({ accountId: schema.users.accountId })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (user) {
    await db
      .delete(schema.matchSummaries)
      .where(eq(schema.matchSummaries.accountId, user.accountId));
  }
  await db.delete(schema.users).where(eq(schema.users.id, userId));
}

export async function updatePreferences(
  userId: string,
  prefs: { preferredBracket: number; preferredPosition: number },
) {
  const db = await getDb();
  await db.update(schema.users).set(prefs).where(eq(schema.users.id, userId));
}
