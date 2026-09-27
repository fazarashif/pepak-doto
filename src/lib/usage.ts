import "server-only";
import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

export type Provider = "opendota" | "stratz" | "steam";

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Catat satu request ke layanan eksternal. Tidak pernah melempar error. */
export async function recordUsage(provider: Provider, remaining?: number | null) {
  try {
    const db = await getDb();
    const rem = Number.isFinite(remaining) ? Number(remaining) : null;
    await db
      .insert(schema.apiUsage)
      .values({ day: today(), provider, requests: 1, remaining: rem })
      .onConflictDoUpdate({
        target: [schema.apiUsage.day, schema.apiUsage.provider],
        set: {
          requests: sql`${schema.apiUsage.requests} + 1`,
          remaining: rem ?? sql`${schema.apiUsage.remaining}`,
          updatedAt: sql`now()`,
        },
      });
  } catch (err) {
    console.warn("[usage] record failed", provider, err);
  }
}

export async function recentUsage(days = 7) {
  const db = await getDb();
  return db
    .select()
    .from(schema.apiUsage)
    .where(sql`${schema.apiUsage.day} >= current_date - ${days}::int`)
    .orderBy(desc(schema.apiUsage.day));
}
