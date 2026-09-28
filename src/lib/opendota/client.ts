import "server-only";
import { cached, HOUR, invalidate, MINUTE } from "@/lib/cache";
import { isParsed } from "@/lib/match/analyze";
import { recordUsage } from "@/lib/usage";
import type {
  HeroStat,
  ItemConstant,
  ItemTimingRow,
  LaneRoleRow,
  Match,
  Matchup,
  PlayerHero,
  PlayerProfile,
  RecentMatch,
} from "./types";

const BASE = "https://api.opendota.com/api";

export class OpenDotaError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = new URL(BASE + path);
  const key = process.env.OPENDOTA_API_KEY;
  if (key) url.searchParams.set("api_key", key);

  const res = await fetch(url, { ...init, cache: "no-store" });
  void recordUsage("opendota", Number(res.headers.get("x-rate-limit-remaining-day")));
  if (!res.ok) {
    throw new OpenDotaError(`OpenDota ${res.status} untuk ${path}`, res.status);
  }
  return (await res.json()) as T;
}

const persist = { persist: true };

// Data meta berubah lambat, jadi di-cache lama (juga di database) untuk menghemat kuota harian.
export const opendota = {
  heroStats: () =>
    cached("od:heroStats", 6 * HOUR, () => request<HeroStat[]>("/heroStats"), persist),

  matchups: (heroId: number) =>
    cached(
      `od:matchups:${heroId}`,
      12 * HOUR,
      () => request<Matchup[]>(`/heroes/${heroId}/matchups`),
      persist,
    ),

  laneRoles: (laneRole: 1 | 2 | 3 | 4) =>
    cached(
      `od:laneRoles:${laneRole}`,
      24 * HOUR,
      () => request<LaneRoleRow[]>(`/scenarios/laneRoles?lane_role=${laneRole}`),
      persist,
    ),

  itemTimings: (heroId: number) =>
    cached(
      `od:itemTimings:${heroId}`,
      24 * HOUR,
      () => request<ItemTimingRow[]>(`/scenarios/itemTimings?hero_id=${heroId}`),
      persist,
    ),

  player: (accountId: number) =>
    cached(`od:player:${accountId}`, 30 * MINUTE, () =>
      request<PlayerProfile>(`/players/${accountId}`),
    ),

  /** Statistik hero pemain dalam setahun terakhir, supaya hero pool mencerminkan kebiasaan sekarang. */
  playerHeroes: (accountId: number) =>
    cached(`od:playerHeroes:${accountId}`, 30 * MINUTE, () =>
      request<PlayerHero[]>(`/players/${accountId}/heroes?date=365`),
    ),

  recentMatches: (accountId: number) =>
    cached(`od:recent:${accountId}`, 5 * MINUTE, () =>
      request<RecentMatch[]>(`/players/${accountId}/recentMatches`),
    ),

  // Match yang sudah di-parse tidak akan berubah; yang belum di-parse dicek ulang tiap menit.
  // JSON match besar (±230 KB), jadi hanya disimpan di memori, tidak di database.
  match: (matchId: number) =>
    cached(
      `od:match:${matchId}`,
      (m: Match) => (isParsed(m) ? 24 * HOUR : MINUTE),
      () => request<Match>(`/matches/${matchId}`),
    ),

  requestParse: async (matchId: number) => {
    await invalidate(`od:match:${matchId}`);
    return request<{ job?: { jobId: number } }>(`/request/${matchId}`, { method: "POST" });
  },

  items: () =>
    cached(
      "od:const:items",
      24 * HOUR,
      () => request<Record<string, ItemConstant>>("/constants/items"),
      persist,
    ),

  itemIds: () =>
    cached(
      "od:const:item_ids",
      24 * HOUR,
      () => request<Record<string, string>>("/constants/item_ids"),
      persist,
    ),
};
