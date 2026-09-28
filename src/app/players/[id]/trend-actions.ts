"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { getHeroes } from "@/lib/heroes";
import { toCoachResult, trendSpec } from "@/lib/llm/narratives";
import type { TrendSummary } from "@/lib/llm/prompts/trend-summary";
import type { CoachResult } from "@/lib/llm/result";
import { generateNarrative } from "@/lib/llm/router";
import { loadPlayer } from "@/lib/players/data";
import { buildTrends } from "@/lib/players/trends";

/** Ringkasan tren untuk profil pemain (butuh login). */
export async function requestTrendSummary(
  accountId: number,
  size: number,
): Promise<CoachResult<TrendSummary>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to get coaching notes." };
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return { ok: false, message: "That player doesn't look right." };
  }
  const n = size === 20 ? 20 : 50;
  try {
    const [player, heroes] = await Promise.all([loadPlayer(accountId, n), getHeroes()]);
    if (player.status !== "ok")
      return { ok: false, message: "This player's matches aren't available." };
    const trends = buildTrends(player.summaries, new Map(heroes.map((h) => [h.id, h.name])));
    const spec = await trendSpec(accountId, trends, player.summaries, n);
    return toCoachResult(await generateNarrative(spec, user.id));
  } catch (err) {
    console.error("[players] trend summary failed", err);
    return { ok: false, message: "Couldn't write notes right now. Try again in a minute." };
  }
}
