// Sinkron harian data hero dari STRATZ dan OpenDota ke tabel `hero_data`.
// Dijalankan oleh scripts/sync-hero-data.ts (GitHub Actions atau manual).
//
// Kenapa tidak langsung dari Vercel: token STRATZ hanya boleh dipakai dari 2 IP per 15 menit,
// sedangkan function Vercel memakai IP yang berganti-ganti.

import {
  createGql,
  fetchHeroProfiles,
  fetchItems,
  fetchMatchups,
  fetchPositions,
  StratzError,
  type Gql,
  type HeroPositionKey,
} from "@/lib/stratz/api";
import type { StratzBracket } from "@/lib/stratz/brackets";
import { mainPositions, summarizeItems, type DurationBin, type HeroDataRow } from "./types";
import { upsertHeroData, writeSyncStatus, type SyncStatus } from "./write";

export const SYNC_BRACKETS: StratzBracket[] = [
  "ALL",
  "HERALD_GUARDIAN",
  "CRUSADER_ARCHON",
  "LEGEND_ANCIENT",
  "DIVINE_IMMORTAL",
];

const MATCHUP_BATCH = 10;
const ITEM_BATCH = 8;
// STRATZ: 8/detik dan 150/menit. Satu request tiap 0,5 detik tetap di bawah keduanya.
const STRATZ_GAP_MS = 500;
// OpenDota tanpa API key: 60/menit.
const OPENDOTA_GAP_MS = 1100;
const MAX_WAIT_MS = 16 * 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function chunks<T>(list: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export interface SyncOptions {
  db: Parameters<typeof upsertHeroData>[0];
  stratzToken: string;
  opendotaKey?: string;
  brackets?: StratzBracket[];
  /** Batasi hero (untuk mencoba). */
  heroIds?: number[];
  skipDurations?: boolean;
  log?: (msg: string) => void;
}

export async function syncHeroData(opts: SyncOptions): Promise<SyncStatus> {
  const log = opts.log ?? console.log;
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  let stratzRequests = 0;
  let remainingDay: number | null = null;
  let rows = 0;

  const rawGql = createGql(opts.stratzToken, (info) => {
    stratzRequests++;
    if (info.remainingDay !== null) remainingDay = info.remainingDay;
  });

  let last = 0;
  /** Request STRATZ satu per satu, dengan jeda dan percobaan ulang kalau kena batas. */
  const gql: Gql = async (query, variables) => {
    for (let attempt = 1; ; attempt++) {
      const wait = last + STRATZ_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      try {
        return await rawGql(query, variables);
      } catch (err) {
        if (!(err instanceof StratzError) || attempt >= 3) throw err;
        let ms = 0;
        if (err.retryAt) ms = err.retryAt.getTime() - Date.now() + 5_000;
        else if (err.status === 429) ms = 60_000;
        else if (err.status >= 500) ms = 10_000;
        else throw err;
        ms = Math.min(Math.max(ms, 1_000), MAX_WAIT_MS);
        log(`STRATZ said "${err.message.slice(0, 120)}". Waiting ${Math.round(ms / 1000)}s.`);
        await sleep(ms);
      }
    }
  };

  const save = async (batch: HeroDataRow[]) => {
    if (!batch.length) return;
    await upsertHeroData(opts.db, batch);
    rows += batch.length;
  };

  let allHeroIds: number[] = [];

  for (const bracket of opts.brackets ?? SYNC_BRACKETS) {
    log(`[${bracket}] positions and hero profiles`);
    let positions;
    try {
      positions = await fetchPositions(gql, bracket);
      const profiles = await fetchHeroProfiles(gql, bracket);
      await save([
        { kind: "positions", bracket, heroId: 0, position: 0, source: "stratz", value: positions },
        { kind: "profiles", bracket, heroId: 0, position: 0, source: "stratz", value: profiles },
      ]);
    } catch (err) {
      errors.push(`[${bracket}] positions: ${String(err)}`);
      log(`[${bracket}] positions failed, skipping this bracket: ${String(err)}`);
      continue;
    }

    const heroIds = [...new Set(positions.map((p) => p.heroId))]
      .filter((id) => !opts.heroIds || opts.heroIds.includes(id))
      .sort((a, b) => a - b);
    if (bracket === "ALL") allHeroIds = heroIds;

    for (const group of chunks(heroIds, MATCHUP_BATCH)) {
      try {
        const result = await fetchMatchups(gql, group, bracket);
        await save(
          group.map((heroId) => ({
            kind: "matchups" as const,
            bracket,
            heroId,
            position: 0,
            source: "stratz" as const,
            value: result.get(heroId)!,
          })),
        );
      } catch (err) {
        errors.push(`[${bracket}] matchups ${group[0]}..: ${String(err)}`);
        log(`[${bracket}] matchups for heroes ${group.join(",")} failed: ${String(err)}`);
      }
    }
    log(`[${bracket}] matchups done for ${heroIds.length} heroes`);

    const combos: (HeroPositionKey & { games: number })[] = heroIds.flatMap((heroId) =>
      mainPositions(positions, heroId).map((p) => ({
        heroId,
        position: p.position,
        games: p.matchCount,
      })),
    );
    for (const group of chunks(combos, ITEM_BATCH)) {
      try {
        const raw = await fetchItems(gql, group, bracket);
        await save(
          group.map((c, i) => ({
            kind: "items" as const,
            bracket,
            heroId: c.heroId,
            position: c.position,
            source: "stratz" as const,
            value: summarizeItems(raw[i], c.games),
          })),
        );
      } catch (err) {
        errors.push(`[${bracket}] items ${group[0].heroId}..: ${String(err)}`);
        log(`[${bracket}] items failed: ${String(err)}`);
      }
    }
    log(`[${bracket}] item builds done for ${combos.length} hero/position pairs`);
  }

  if (!opts.skipDurations && allHeroIds.length) {
    log(`[OpenDota] win rate by game length for ${allHeroIds.length} heroes`);
    for (const heroId of allHeroIds) {
      try {
        const bins = await fetchDurations(heroId, opts.opendotaKey);
        await save([
          {
            kind: "durations",
            bracket: "ALL",
            heroId,
            position: 0,
            source: "opendota",
            value: bins,
          },
        ]);
      } catch (err) {
        errors.push(`[OpenDota] durations ${heroId}: ${String(err)}`);
      }
      await sleep(OPENDOTA_GAP_MS);
    }
  }

  const status: SyncStatus = {
    startedAt,
    finishedAt: new Date().toISOString(),
    ok: errors.length === 0,
    rows,
    stratzRequests,
    stratzRemainingDay: remainingDay,
    errors: errors.slice(0, 20),
  };
  await writeSyncStatus(opts.db, status);
  return status;
}

async function fetchDurations(heroId: number, key?: string): Promise<DurationBin[]> {
  const url = new URL(`https://api.opendota.com/api/heroes/${heroId}/durations`);
  if (key) url.searchParams.set("api_key", key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenDota ${res.status}`);
  const raw = (await res.json()) as { duration_bin: number; games_played: number; wins: number }[];
  return raw
    .map((r): DurationBin => [Math.round(r.duration_bin / 60), r.games_played, r.wins])
    .sort((a, b) => a[0] - b[0]);
}
