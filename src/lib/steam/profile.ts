import "server-only";
import { steamIdToAccountId } from "@/lib/dota";
import { opendota } from "@/lib/opendota/client";
import { recordUsage } from "@/lib/usage";

export interface SteamProfile {
  steamId: string;
  accountId: number;
  personaName: string;
  avatarUrl: string | null;
  profileUrl: string | null;
  rankTier: number | null;
}

interface PlayerSummary {
  personaname?: string;
  avatarfull?: string;
  profileurl?: string;
}

async function fromSteamApi(steamId: string): Promise<PlayerSummary | null> {
  const key = process.env.STEAM_WEB_API_KEY;
  if (!key) return null;
  try {
    const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    url.searchParams.set("key", key);
    url.searchParams.set("steamids", steamId);
    const res = await fetch(url, { cache: "no-store" });
    void recordUsage("steam");
    if (!res.ok) return null;
    const body = (await res.json()) as { response?: { players?: PlayerSummary[] } };
    return body.response?.players?.[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Nama dan avatar dari Steam Web API kalau key tersedia, dengan OpenDota sebagai cadangan.
 * Rank selalu dari OpenDota. Tidak pernah gagal: data yang tidak ada diisi default.
 */
export async function loadSteamProfile(steamId: string): Promise<SteamProfile> {
  const accountId = steamIdToAccountId(steamId);
  const [steam, od] = await Promise.all([
    fromSteamApi(steamId),
    opendota.player(accountId).catch(() => null),
  ]);

  return {
    steamId,
    accountId,
    personaName: steam?.personaname ?? od?.profile?.personaname ?? `Player ${accountId}`,
    avatarUrl: steam?.avatarfull ?? od?.profile?.avatarfull ?? null,
    profileUrl: steam?.profileurl ?? od?.profile?.profileurl ?? null,
    rankTier: od?.rank_tier ?? null,
  };
}
