import "server-only";
import { cached, HOUR, invalidate, MINUTE } from "@/lib/cache";
import type {
  HeroStat,
  ItemConstant,
  ItemTimingRow,
  LaneRoleRow,
  Match,
  Matchup,
  PlayerHero,
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
  if (!res.ok) {
    throw new OpenDotaError(`OpenDota ${res.status} untuk ${path}`, res.status);
  }
  return (await res.json()) as T;
}

export function isParsed(match: Match) {
  return Boolean(match.od_data?.has_parsed ?? match.version);
}

// Data meta berubah lambat, jadi di-cache lama untuk menghemat kuota harian.
export const opendota = {
  heroStats: () => cached("heroStats", 6 * HOUR, () => request<HeroStat[]>("/heroStats")),

  matchups: (heroId: number) =>
    cached(`matchups:${heroId}`, 12 * HOUR, () =>
      request<Matchup[]>(`/heroes/${heroId}/matchups`),
    ),

  laneRoles: (laneRole: 1 | 2 | 3 | 4) =>
    cached(`laneRoles:${laneRole}`, 24 * HOUR, () =>
      request<LaneRoleRow[]>(`/scenarios/laneRoles?lane_role=${laneRole}`),
    ),

  itemTimings: (heroId: number) =>
    cached(`itemTimings:${heroId}`, 24 * HOUR, () =>
      request<ItemTimingRow[]>(`/scenarios/itemTimings?hero_id=${heroId}`),
    ),

  playerHeroes: (accountId: number) =>
    cached(`playerHeroes:${accountId}`, 30 * MINUTE, () =>
      request<PlayerHero[]>(`/players/${accountId}/heroes`),
    ),

  recentMatches: (accountId: number) =>
    cached(`recent:${accountId}`, 5 * MINUTE, () =>
      request<RecentMatch[]>(`/players/${accountId}/recentMatches`),
    ),

  // Match yang sudah di-parse tidak akan berubah; yang belum di-parse dicek ulang tiap menit.
  match: (matchId: number) =>
    cached(
      `match:${matchId}`,
      (m: Match) => (isParsed(m) ? 24 * HOUR : MINUTE),
      () => request<Match>(`/matches/${matchId}`),
    ),

  requestParse: async (matchId: number) => {
    invalidate(`match:${matchId}`);
    return request<{ job?: { jobId: number } }>(`/request/${matchId}`, { method: "POST" });
  },

  items: () =>
    cached("const:items", 24 * HOUR, () =>
      request<Record<string, ItemConstant>>("/constants/items"),
    ),

  itemIds: () =>
    cached("const:item_ids", 24 * HOUR, () =>
      request<Record<string, string>>("/constants/item_ids"),
    ),
};
