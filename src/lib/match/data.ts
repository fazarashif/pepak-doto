import "server-only";
import { assetUrl } from "@/lib/dota";
import { getHeroes } from "@/lib/heroes";
import { analyzeMatch, isParsed, TURBO_GAME_MODE, type MatchReport } from "@/lib/match/analyze";
import { OpenDotaError, opendota } from "@/lib/opendota/client";
import type { Match } from "@/lib/opendota/types";

export type MatchLookup =
  | { status: "ok"; match: Match }
  | { status: "not-found" }
  | { status: "turbo"; match: Match }
  | { status: "error"; message: string };

export async function lookupMatch(matchId: number): Promise<MatchLookup> {
  try {
    const match = await opendota.match(matchId);
    if (match.game_mode === TURBO_GAME_MODE) return { status: "turbo", match };
    return { status: "ok", match };
  } catch (err) {
    if (err instanceof OpenDotaError && (err.status === 404 || err.status === 400)) {
      return { status: "not-found" };
    }
    if (err instanceof OpenDotaError && err.status === 429) {
      return {
        status: "error",
        message: "OpenDota is rate limiting us right now. Try again in a minute.",
      };
    }
    throw err;
  }
}

export async function buildReport(match: Match, slot: number): Promise<MatchReport> {
  const player = match.players.find((p) => p.player_slot === slot);
  const parsed = isParsed(match);
  const [heroes, items, itemIds, itemTimings] = await Promise.all([
    getHeroes(),
    opendota.items(),
    opendota.itemIds(),
    parsed && player ? opendota.itemTimings(player.hero_id).catch(() => []) : Promise.resolve([]),
  ]);

  return analyzeMatch(match, slot, {
    heroes: new Map(heroes.map((h) => [h.id, h])),
    heroesByKey: new Map(heroes.map((h) => [h.key, h])),
    items,
    itemIds,
    itemTimings,
    assetUrl,
  });
}
