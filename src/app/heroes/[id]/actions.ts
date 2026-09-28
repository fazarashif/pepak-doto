"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { loadCheatSheet } from "@/lib/live/data";
import { heroTipsSpec, toCoachResult } from "@/lib/llm/narratives";
import type { HeroTips } from "@/lib/llm/prompts/hero-tips";
import type { CoachResult } from "@/lib/llm/result";
import { generateNarrative } from "@/lib/llm/router";

/** Tips "cara melawan hero ini". Setelah dibuat, disimpan untuk semua orang (butuh login). */
export async function requestHeroTips(
  heroId: number,
  bracket: number,
): Promise<CoachResult<HeroTips>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in to get tips." };
  if (!Number.isInteger(heroId) || ![0, 1, 3, 5, 7].includes(bracket)) {
    return { ok: false, message: "That hero doesn't look right." };
  }
  try {
    const data = await loadCheatSheet(heroId, bracket);
    if (!data) return { ok: false, message: "That hero doesn't exist." };
    const spec = await heroTipsSpec(heroId, bracket, data.bracketLabel, data.sheet);
    return toCoachResult(await generateNarrative(spec, user.id));
  } catch (err) {
    console.error("[heroes] tips failed", err);
    return { ok: false, message: "Couldn't write tips right now. Try again in a minute." };
  }
}
