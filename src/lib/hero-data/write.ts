// Menulis hasil sinkron ke tabel `hero_data`. Dipakai aplikasi dan script sinkron,
// jadi tidak memakai getDb() (yang hanya bisa jalan di server Next.js).

import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { appSettings, heroData } from "@/lib/db/schema";
import type { HeroDataRow } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

const CHUNK = 50;

export async function upsertHeroData(db: AnyDb, rows: HeroDataRow[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((r) => ({
      kind: r.kind,
      bracket: r.bracket,
      heroId: r.heroId,
      position: r.position,
      source: r.source,
      value: r.value,
    }));
    await db
      .insert(heroData)
      .values(chunk)
      .onConflictDoUpdate({
        target: [heroData.kind, heroData.bracket, heroData.heroId, heroData.position],
        set: {
          value: sql`excluded.value`,
          source: sql`excluded.source`,
          syncedAt: sql`now()`,
        },
      });
  }
}

export const SYNC_STATUS_KEY = "hero_data_sync";

export interface SyncStatus {
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  rows: number;
  stratzRequests: number;
  stratzRemainingDay: number | null;
  errors: string[];
}

export async function writeSyncStatus(db: AnyDb, status: SyncStatus) {
  await db
    .insert(appSettings)
    .values({ key: SYNC_STATUS_KEY, value: status })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: sql`excluded.value`, updatedAt: sql`now()` },
    });
}
