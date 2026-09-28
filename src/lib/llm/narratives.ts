import "server-only";
import { cached, HOUR } from "@/lib/cache";
import { rankTierLabel } from "@/lib/dota";
import { getHeroes } from "@/lib/heroes";
import { getItemInfo, traits } from "@/lib/live/data";
import type { MatchReport } from "@/lib/match/analyze";
import type { CheatSheet } from "@/lib/plan/cheat-sheet";
import type { MatchSummary } from "@/lib/players/summary";
import type { Trends } from "@/lib/players/trends";
import type { Vocabulary } from "./prompts/common";
import {
  HERO_TIPS_SYSTEM,
  HERO_TIPS_VERSION,
  heroTipsFacts,
  heroTipsTemplate,
  parseHeroTips,
  type HeroTips,
} from "./prompts/hero-tips";
import {
  MATCH_NOTES_SYSTEM,
  MATCH_NOTES_VERSION,
  matchNotesFacts,
  matchNotesTemplate,
  parseMatchNotes,
  type MatchNotes,
} from "./prompts/match-notes";
import {
  parseTrendSummary,
  TREND_SUMMARY_SYSTEM,
  TREND_SUMMARY_VERSION,
  trendFacts,
  trendTemplate,
  type TrendSummary,
} from "./prompts/trend-summary";
import { modelLabel, TEMPLATE_NOTE, type CoachResult } from "./result";
import { getStoredNarrative, type NarrativeResult, type NarrativeSpec } from "./router";

/** Semua nama hero dan item, untuk memeriksa jawaban model. */
async function vocabulary(): Promise<Vocabulary> {
  return cached("llm:vocabulary", 12 * HOUR, async () => {
    const [heroes, items] = await Promise.all([getHeroes(), getItemInfo()]);
    // Item resep dan item yang namanya terlalu umum tidak ikut diperiksa.
    const itemNames = [...items.values()]
      .map((i) => i.name)
      .filter((n) => !/recipe/i.test(n) && n.length >= 4);
    return { names: [...heroes.map((h) => h.name), ...itemNames] };
  });
}

const prompt = (facts: unknown) => `Facts:\n${JSON.stringify(facts, null, 1)}`;

// --- Match review

export const matchNotesKey = (matchId: number, slot: number, parsed: boolean) =>
  `${matchId}:${slot}:${parsed ? "p" : "u"}`;

export function storedMatchNotes(key: string) {
  return getStoredNarrative<MatchNotes>("match", key, MATCH_NOTES_VERSION);
}

export async function matchNotesSpec(report: MatchReport): Promise<NarrativeSpec<MatchNotes>> {
  const [heroes, vocab] = await Promise.all([getHeroes(), vocabulary()]);
  const heroNames = new Map(heroes.map((h) => [h.id, h.name]));
  const heroName = heroNames.get(report.player.heroId) ?? "Unknown hero";
  const { facts, allowed } = matchNotesFacts(report, {
    heroName,
    heroNames,
    rankLabel: report.player.rankTier ? rankTierLabel(report.player.rankTier) : null,
  });
  return {
    kind: "match",
    key: matchNotesKey(report.matchId, report.player.slot, report.parsed),
    version: MATCH_NOTES_VERSION,
    system: MATCH_NOTES_SYSTEM,
    prompt: prompt(facts),
    maxTokens: 700,
    parse: (json) => parseMatchNotes(json, allowed, vocab),
    template: () => matchNotesTemplate(report),
  };
}

// --- Tren profil pemain

export const trendKey = (accountId: number, matches: MatchSummary[], size: number) =>
  `${accountId}:${matches[0]?.matchId ?? 0}:${size}`;

export function storedTrendSummary(key: string) {
  return getStoredNarrative<TrendSummary>("trends", key, TREND_SUMMARY_VERSION);
}

export async function trendSpec(
  accountId: number,
  trends: Trends,
  matches: MatchSummary[],
  size: number,
): Promise<NarrativeSpec<TrendSummary>> {
  const vocab = await vocabulary();
  const replayMetrics = matches.some((m) => m.replay);
  const { facts, allowed, metrics } = trendFacts(trends, matches, { replayMetrics });
  return {
    kind: "trends",
    key: trendKey(accountId, matches, size),
    version: TREND_SUMMARY_VERSION,
    system: TREND_SUMMARY_SYSTEM,
    prompt: prompt(facts),
    maxTokens: 500,
    parse: (json) => parseTrendSummary(json, allowed, metrics, vocab),
    template: () => trendTemplate(trends, matches),
  };
}

// --- Cheat sheet hero

export const heroTipsKey = (heroId: number, bracket: number) =>
  `${heroId}:${bracket}:${traits.patch}`;

export function storedHeroTips(key: string) {
  return getStoredNarrative<HeroTips>("hero", key, HERO_TIPS_VERSION);
}

export async function heroTipsSpec(
  heroId: number,
  bracket: number,
  bracketLabel: string,
  sheet: CheatSheet,
): Promise<NarrativeSpec<HeroTips>> {
  const [heroes, vocab] = await Promise.all([getHeroes(), vocabulary()]);
  const heroNames = new Map(heroes.map((h) => [h.id, h.name]));
  const heroName = heroNames.get(heroId) ?? "this hero";
  const { facts, allowed } = heroTipsFacts(sheet, {
    heroName,
    rankLabel: bracketLabel,
    traits: traits.heroes[String(heroId)]?.traits ?? [],
    heroNames,
  });
  return {
    kind: "hero",
    key: heroTipsKey(heroId, bracket),
    version: HERO_TIPS_VERSION,
    system: HERO_TIPS_SYSTEM,
    prompt: prompt(facts),
    maxTokens: 500,
    parse: (json) => parseHeroTips(json, allowed, vocab),
    template: () => heroTipsTemplate(sheet, { heroName, heroNames }),
  };
}

/** Ubah hasil router jadi bentuk yang dikirim ke komponen client. */
export function toCoachResult<T>(r: NarrativeResult<T>): CoachResult<T> {
  if (r.source === "template") {
    return { ok: true, content: r.content, by: null, note: TEMPLATE_NOTE[r.reason] };
  }
  return { ok: true, content: r.content, by: modelLabel(r.model), note: null };
}

/** Narasi tersimpan sebagai hasil siap tampil (untuk render awal di server). */
export function storedAsResult<T>(
  stored: { content: T; model: string } | null,
): CoachResult<T> | null {
  return stored
    ? { ok: true, content: stored.content, by: modelLabel(stored.model), note: null }
    : null;
}
