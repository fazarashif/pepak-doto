// Tips "cara melawan hero X" untuk cheat sheet. Disimpan per hero per kelompok rank per patch.

import { TRAIT_PHRASE, type HeroTrait } from "@/lib/items/traits";
import type { CheatSheet } from "@/lib/plan/cheat-sheet";
import { nameError, str, STYLE, type Vocabulary } from "./common";

export const HERO_TIPS_VERSION = 1;

export interface HeroTips {
  tips: string[];
}

export const HERO_TIPS_SYSTEM = [
  "You are a Dota 2 coach writing a cheat sheet on how to play against one hero.",
  STYLE,
  "Each tip should tell the reader what to do, and why, using the facts.",
  'Shape: {"tips": [string] (3 to 5 tips, each at most 2 sentences)}.',
].join(" ");

export function heroTipsFacts(
  sheet: CheatSheet,
  ctx: {
    heroName: string;
    rankLabel: string;
    traits: HeroTrait[];
    heroNames: Map<number, string>;
  },
) {
  const counters = sheet.counters.slice(0, 5).map((c) => ({
    hero: ctx.heroNames.get(c.heroId) ?? "Unknown",
    edge_percent: Math.round(c.advantage * 10) / 10,
  }));
  const counterItems = sheet.counterItems.map((g) => ({
    reason: g.reason,
    core: g.items.core.map((i) => i.name),
    offlane: g.items.offlane.map((i) => i.name),
    support: g.items.support.map((i) => i.name),
  }));
  const facts = {
    hero: ctx.heroName,
    rank: ctx.rankLabel,
    traits: ctx.traits.map((t) => TRAIT_PHRASE[t].one),
    heroes_that_do_well_against_it: counters,
    counter_items: counterItems,
    abilities_to_watch: sheet.dangerous.map((a) => ({
      name: a.name,
      goes_through_bkb: a.bkbPierce,
    })),
    key_items_and_usual_minute: sheet.keyItems.map((k) => ({
      item: k.item.name,
      minute: k.medianMinute,
    })),
    strongest_in_games_ending_around_minute: sheet.peakMinute,
    damage: sheet.damage && {
      physical: Math.round(sheet.damage.physical * 100),
      magic: Math.round(sheet.damage.magical * 100),
      pure: Math.round(sheet.damage.pure * 100),
    },
  };
  const allowed = [
    ctx.heroName,
    ...counters.map((c) => c.hero),
    ...counterItems.flatMap((g) => [...g.core, ...g.offlane, ...g.support]),
    ...sheet.keyItems.map((k) => k.item.name),
  ];
  return { facts, allowed };
}

export function parseHeroTips(
  json: unknown,
  allowed: string[],
  vocab: Vocabulary,
): { value: HeroTips } | { error: string } {
  const list = (json as Record<string, unknown>)?.tips;
  if (!Array.isArray(list) || list.length < 3 || list.length > 5) {
    return { error: "tips must have 3 to 5 items" };
  }
  const tips: string[] = [];
  for (const t of list) {
    const s = str(t, 320);
    if (!s) return { error: "Empty or too long tip" };
    tips.push(s);
  }
  const bad = nameError(tips, allowed, vocab);
  return bad ? { error: bad } : { value: { tips } };
}

/** Cadangan tanpa LLM: kalimat langsung dari data cheat sheet. */
export function heroTipsTemplate(
  sheet: CheatSheet,
  ctx: { heroName: string; heroNames: Map<number, string> },
): HeroTips {
  const tips: string[] = [];
  const first = sheet.counterItems[0];
  if (first) {
    const items = [...first.items.core, ...first.items.support].slice(0, 2).map((i) => i.name);
    tips.push(`${first.reason}${items.length ? ` Consider ${items.join(" or ")}.` : ""}`);
  }
  if (sheet.keyItems.length) {
    const k = sheet.keyItems
      .slice(0, 2)
      .map((i) => `${i.item.name} (around minute ${i.medianMinute})`)
      .join(" and ");
    tips.push(`Pressure ${ctx.heroName} before ${k}.`);
  }
  const counters = sheet.counters
    .slice(0, 3)
    .map((c) => ctx.heroNames.get(c.heroId))
    .filter(Boolean);
  if (counters.length)
    tips.push(`${counters.join(", ")} do well against ${ctx.heroName} at this rank.`);
  if (sheet.dangerous.length) {
    tips.push(`Keep track of ${sheet.dangerous.map((a) => a.name).join(" and ")}.`);
  }
  if (sheet.peakMinute !== null) {
    tips.push(`${ctx.heroName} is strongest in games that end around minute ${sheet.peakMinute}.`);
  }
  return { tips: tips.slice(0, 5) };
}
