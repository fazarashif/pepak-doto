import type { NextRequest } from "next/server";
import { purgeExpired } from "@/lib/cache";
import { opendota } from "@/lib/opendota/client";

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

  return Response.json(results);
}
