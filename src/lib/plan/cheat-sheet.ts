// Cheat sheet "cara melawan hero X". Fungsi murni; datanya dari src/lib/live/data.ts.

import type { DurationBin, ItemBuild } from "@/lib/hero-data/types";
import type { CounterRulesFile, ItemInfo, Role } from "@/lib/items/advisor";
import { TRAIT_PHRASE, type HeroTraitsFile } from "@/lib/items/traits";
import { heroStrength, type AbilityInfo } from "@/lib/plan/game-plan";
import type { HeroMatchups, HeroProfile } from "@/lib/stratz/api";

/** Sama dengan draft: keunggulan dihaluskan menurut jumlah match. */
const PAIR_SHRINK = 300;
const MIN_PAIR_MATCHES = 200;
const COUNTERS_SHOWN = 8;
const VICTIMS_SHOWN = 5;
const KEY_ITEMS = 4;
const KEY_ITEM_MIN_COST = 2000;
const KEY_ITEM_MIN_SHARE = 0.15;

export interface MatchupEntry {
  heroId: number;
  /** Keunggulan hero lawan dalam poin persen (positif = lawan diuntungkan). */
  advantage: number;
  matches: number;
}

export interface CounterItemGroup {
  reason: string;
  items: Record<Role, ItemInfo[]>;
}

export interface KeyItem {
  item: ItemInfo;
  medianMinute: number;
  share: number;
}

export interface CheatSheet {
  counters: MatchupEntry[];
  goodAgainst: MatchupEntry[];
  counterItems: CounterItemGroup[];
  dangerous: AbilityInfo[];
  /** Kekuatan per durasi (bin 5 menit), relatif terhadap winrate rata-rata hero. */
  strength: { minute: number; value: number }[];
  peakMinute: number | null;
  damage: { physical: number; magical: number; pure: number } | null;
  keyItems: KeyItem[];
}

export function buildCheatSheet(input: {
  heroId: number;
  heroName: string;
  matchups: HeroMatchups | null;
  profiles: HeroProfile[] | null;
  durations: DurationBin[] | null;
  build: ItemBuild | null;
  traits: HeroTraitsFile;
  rules: CounterRulesFile;
  items: Map<string, ItemInfo>;
  abilities: Map<string, AbilityInfo>;
}): CheatSheet {
  // --- Matchup: `vs` berisi keunggulan hero ini melawan hero lain.
  const pairs = (input.matchups?.vs ?? [])
    .filter(([, n]) => n >= MIN_PAIR_MATCHES)
    .map(([heroId, n, synergy]) => ({
      heroId,
      matches: n,
      advantage: -synergy * (n / (n + PAIR_SHRINK)),
    }));
  const counters = pairs
    .filter((p) => p.advantage > 0)
    .sort((a, b) => b.advantage - a.advantage)
    .slice(0, COUNTERS_SHOWN);
  const goodAgainst = pairs
    .filter((p) => p.advantage < 0)
    .sort((a, b) => a.advantage - b.advantage)
    .slice(0, VICTIMS_SHOWN);

  // --- Tipe damage hero ini.
  const profile = input.profiles?.find((p) => p.heroId === input.heroId);
  const total = profile ? profile.physicalDamage + profile.magicalDamage + profile.pureDamage : 0;
  const damage =
    profile && total
      ? {
          physical: profile.physicalDamage / total,
          magical: profile.magicalDamage / total,
          pure: profile.pureDamage / total,
        }
      : null;

  // --- Item counter: aturan yang sama dengan Game Plan, untuk satu hero.
  const entry = input.traits.heroes[String(input.heroId)];
  const counterItems: CounterItemGroup[] = [];
  for (const rule of input.rules.rules) {
    let reason: string | null = null;
    if ("trait" in rule.when) {
      if (entry?.traits.includes(rule.when.trait)) {
        reason = `${input.heroName} ${TRAIT_PHRASE[rule.when.trait].one}. ${rule.how}`;
      }
    } else if (damage) {
      const share = rule.when.stat === "magicShare" ? damage.magical : damage.physical;
      // Satu hero dinilai lebih ketat daripada satu tim.
      if (share >= Math.max(rule.when.min, 0.65)) {
        reason = `${Math.round(share * 100)}% of ${input.heroName}'s damage is ${rule.when.stat === "magicShare" ? "magic" : "physical"}.`;
      }
    }
    if (!reason) continue;
    const pick = (keys: string[]) =>
      keys
        .slice(0, 3)
        .map((k) => input.items.get(k))
        .filter((i): i is ItemInfo => Boolean(i));
    counterItems.push({
      reason,
      items: {
        core: pick(rule.items.core),
        offlane: pick(rule.items.offlane),
        support: pick(rule.items.support),
      },
    });
  }

  const dangerous = (entry?.dangerous ?? [])
    .map((k) => input.abilities.get(k))
    .filter((a): a is AbilityInfo => Boolean(a))
    .map((a) => ({
      ...a,
      bkbPierce: a.bkbPierce && (entry?.traits.includes("bkbPierce") ?? false),
    }));

  // --- Kurva kekuatan.
  const curve = input.durations?.length ? heroStrength(input.durations) : new Map<number, number>();
  const strength = [...curve.entries()].map(([minute, value]) => ({ minute, value }));
  const peak = strength.reduce<{ minute: number; value: number } | null>(
    (best, p) => (!best || p.value > best.value ? p : best),
    null,
  );

  // --- Item penting hero ini, supaya tahu kapan dia mulai berbahaya.
  const games = Math.max(input.build?.games ?? 0, 1);
  const byId = new Map([...input.items.values()].map((i) => [i.id, i]));
  const keyItems = (input.build?.items ?? [])
    .map((b) => ({ b, item: byId.get(b.itemId) }))
    .filter(
      (x): x is { b: (typeof x)["b"]; item: ItemInfo } =>
        Boolean(x.item) &&
        x.item!.cost >= KEY_ITEM_MIN_COST &&
        x.b.matches / games >= KEY_ITEM_MIN_SHARE,
    )
    .sort((a, b) => b.b.matches - a.b.matches)
    .slice(0, KEY_ITEMS)
    .sort((a, b) => a.b.medianMinute - b.b.medianMinute)
    .map(({ b, item }) => ({
      item,
      medianMinute: b.medianMinute,
      share: Math.min(1, b.matches / games),
    }));

  return {
    counters,
    goodAgainst,
    counterItems,
    dangerous,
    strength,
    peakMinute: peak && peak.value > 0.01 ? peak.minute : null,
    damage,
    keyItems,
  };
}
