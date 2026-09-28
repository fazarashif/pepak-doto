import { gte } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { purgeExpired } from "@/lib/cache";
import { getDb, schema } from "@/lib/db";
import { opendota } from "@/lib/opendota/client";
import { syncUserMatches } from "@/lib/players/data";

export const maxDuration = 60;

/** User yang login dalam 14 hari terakhir ikut parse otomatis. */
const ACTIVE_DAYS = 14;
/** Berhenti memproses user baru setelah sekian detik supaya tidak melewati batas waktu. */
const BUDGET_MS = 45_000;

// Dijalankan Vercel Cron sekali sehari (lihat vercel.json).
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results: Record<string, string> = {};
  try {
    await purgeExpired();
    results.purge = "ok";
  } catch (err) {
    results.purge = err instanceof Error ? err.message : "failed";
  }
  try {
    // Panaskan cache meta supaya request pertama user hari ini tetap cepat.
    await opendota.heroStats();
    results.heroStats = "ok";
  } catch (err) {
    results.heroStats = err instanceof Error ? err.message : "failed";
  }

  // Parse otomatis dan statistik replay untuk user yang aktif (PRD D26).
  const started = Date.now();
  try {
    const db = await getDb();
    const since = new Date(Date.now() - ACTIVE_DAYS * 86_400_000);
    const active = await db
      .select({ accountId: schema.users.accountId })
      .from(schema.users)
      .where(gte(schema.users.lastLoginAt, since));
    let done = 0;
    let parse = 0;
    let replays = 0;
    for (const { accountId } of active) {
      if (Date.now() - started > BUDGET_MS) break;
      try {
        const r = await syncUserMatches(accountId);
        parse += r.parseRequested;
        replays += r.replaysRead;
        done++;
      } catch (err) {
        console.warn("[cron] player sync failed", accountId, err);
      }
    }
    results.players = `${done}/${active.length} users, ${parse} parse requests, ${replays} replays read`;
  } catch (err) {
    results.players = err instanceof Error ? err.message : "failed";
  }

  return Response.json(results);
}
