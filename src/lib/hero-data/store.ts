import "server-only";
import { and, eq } from "drizzle-orm";
import { cached, HOUR, MINUTE } from "@/lib/cache";
import { getDb, schema } from "@/lib/db";
import { opendota } from "@/lib/opendota/client";
import {
  fetchHeroProfiles,
  fetchItems,
  fetchMatchups,
  fetchPositions,
  type HeroMatchups,
  type HeroPositionStat,
  type HeroProfile,
} from "@/lib/stratz/api";
import { toStratzBracket, type StratzBracket } from "@/lib/stratz/brackets";
import { canFetchStratzLive, stratzGql } from "@/lib/stratz/client";
import {
  summarizeItems,
  type DurationBin,
  type HeroDataKind,
  type HeroDataRow,
  type ItemBuild,
} from "./types";
import { SYNC_STATUS_KEY, upsertHeroData, type SyncStatus } from "./write";

// Data hero dibaca dari tabel `hero_data` (diisi sinkron harian). Kalau belum ada dan server
// boleh memanggil sumbernya langsung (laptop untuk STRATZ, di mana saja untuk OpenDota),
// data diambil lalu disimpan.

const MEMORY_TTL = 30 * MINUTE;
/** Data yang lebih tua dari ini diambil ulang kalau sumbernya boleh dipanggil langsung. */
const LOCAL_REFRESH_AFTER = 24 * HOUR;

interface Key {
  kind: HeroDataKind;
  bracket: StratzBracket;
  heroId: number;
  position: number;
}

async function readRow<T>(key: Key): Promise<{ value: T; syncedAt: Date } | null> {
  const db = await getDb();
  const t = schema.heroData;
  const [row] = await db
    .select({ value: t.value, syncedAt: t.syncedAt })
    .from(t)
    .where(
      and(
        eq(t.kind, key.kind),
        eq(t.bracket, key.bracket),
        eq(t.heroId, key.heroId),
        eq(t.position, key.position),
      ),
    )
    .limit(1);
  return row ? { value: row.value as T, syncedAt: row.syncedAt } : null;
}

/**
 * Baca satu baris. `live` dipanggil kalau baris belum ada (atau sudah tua di laptop);
 * hasilnya disimpan. Mengembalikan null kalau data tidak tersedia.
 */
function load<T>(
  key: Key,
  source: HeroDataRow["source"],
  live: (() => Promise<T>) | null,
): Promise<T | null> {
  const cacheKey = `hd:${key.kind}:${key.bracket}:${key.heroId}:${key.position}`;
  return cached(cacheKey, MEMORY_TTL, async () => {
    let row: { value: T; syncedAt: Date } | null = null;
    try {
      row = await readRow<T>(key);
    } catch (err) {
      console.warn("[hero-data] read failed", cacheKey, err);
    }
    const stale = !row || Date.now() - row.syncedAt.getTime() > LOCAL_REFRESH_AFTER;
    if (row && (!stale || !live)) return row.value;
    if (!live) return null;

    try {
      const value = await live();
      try {
        await upsertHeroData(await getDb(), [{ ...key, source, value }]);
      } catch (err) {
        console.warn("[hero-data] write failed", cacheKey, err);
      }
      return value;
    } catch (err) {
      console.warn("[hero-data] live fetch failed", cacheKey, err);
      return row?.value ?? null;
    }
  });
}

const stratzLive = <T>(fn: () => Promise<T>) => (canFetchStratzLive() ? fn : null);

export function getPositions(bracket: number): Promise<HeroPositionStat[] | null> {
  const b = toStratzBracket(bracket);
  return load(
    { kind: "positions", bracket: b, heroId: 0, position: 0 },
    "stratz",
    stratzLive(() => fetchPositions(stratzGql(), b)),
  );
}

export function getProfiles(bracket: number): Promise<HeroProfile[] | null> {
  const b = toStratzBracket(bracket);
  return load(
    { kind: "profiles", bracket: b, heroId: 0, position: 0 },
    "stratz",
    stratzLive(() => fetchHeroProfiles(stratzGql(), b)),
  );
}

export function getMatchups(heroId: number, bracket: number): Promise<HeroMatchups | null> {
  const b = toStratzBracket(bracket);
  return load(
    { kind: "matchups", bracket: b, heroId, position: 0 },
    "stratz",
    stratzLive(async () => (await fetchMatchups(stratzGql(), [heroId], b)).get(heroId)!),
  );
}

export function getItemBuild(
  heroId: number,
  position: number,
  bracket: number,
): Promise<ItemBuild | null> {
  const b = toStratzBracket(bracket);
  return load(
    { kind: "items", bracket: b, heroId, position },
    "stratz",
    stratzLive(async () => {
      const positions = await getPositions(bracket);
      const games =
        positions?.find((p) => p.heroId === heroId && p.position === position)?.matchCount ?? 0;
      const [raw] = await fetchItems(stratzGql(), [{ heroId, position }], b);
      return summarizeItems(raw, games);
    }),
  );
}

/** Winrate per durasi game (bin 5 menit, semua rank). Sumbernya OpenDota. */
export function getDurations(heroId: number): Promise<DurationBin[] | null> {
  return load({ kind: "durations", bracket: "ALL", heroId, position: 0 }, "opendota", async () =>
    (await opendota.durations(heroId))
      .map((r): DurationBin => [Math.round(r.duration_bin / 60), r.games_played, r.wins])
      .sort((a, b) => a[0] - b[0]),
  );
}

export async function getSyncStatus(): Promise<SyncStatus | null> {
  const db = await getDb();
  const [row] = await db
    .select({ value: schema.appSettings.value })
    .from(schema.appSettings)
    .where(eq(schema.appSettings.key, SYNC_STATUS_KEY))
    .limit(1);
  return (row?.value as SyncStatus | undefined) ?? null;
}
