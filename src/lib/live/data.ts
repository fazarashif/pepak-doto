import "server-only";
import counterRules from "../../../data/counter-items.json";
import heroTraits from "../../../data/hero-traits.json";
import { cached, HOUR } from "@/lib/cache";
import { assetUrl, bracketGroupLabel, type HeroInfo } from "@/lib/dota";
import { getDurations, getItemBuild, getPositions, getProfiles } from "@/lib/hero-data/store";
import type { DurationBin } from "@/lib/hero-data/types";
import { getHeroes } from "@/lib/heroes";
import { advise, type Advice, type CounterRulesFile, type ItemInfo } from "@/lib/items/advisor";
import type { HeroTraitsFile } from "@/lib/items/traits";
import { opendota } from "@/lib/opendota/client";
import { buildGamePlan, type AbilityInfo, type GamePlan } from "@/lib/plan/game-plan";
import type { LiveState } from "./types";

export const traits = heroTraits as HeroTraitsFile;
export const rules = counterRules as CounterRulesFile;

/** Nama skill dan status menembus BKB, hanya untuk skill yang disebut di hero-traits.json. */
export function getAbilityInfo(): Promise<Map<string, AbilityInfo>> {
  return cached(
    `od:abilityInfo:${traits.patch}`,
    24 * HOUR,
    async () => {
      const all = await opendota.abilities();
      const keys = new Set(Object.values(traits.heroes).flatMap((h) => h.dangerous));
      return [...keys]
        .filter((k) => all[k])
        .map((k): AbilityInfo => ({
          key: k,
          name: all[k].dname ?? k,
          bkbPierce: all[k].bkbpierce === "Yes",
        }));
    },
    { persist: true },
  ).then((list) => new Map(list.map((a) => [a.key, a])));
}

export async function getItemInfo(): Promise<Map<string, ItemInfo>> {
  const items = await opendota.items();
  const out = new Map<string, ItemInfo>();
  for (const [key, c] of Object.entries(items)) {
    if (!c.id) continue;
    out.set(key, {
      id: c.id,
      key,
      name: c.dname ?? key,
      cost: c.cost ?? 0,
      qual: c.qual,
      components: c.components ?? [],
      img: c.img ? assetUrl(c.img) : undefined,
    });
  }
  return out;
}

export type LivePlan =
  | { status: "no-hero"; heroes: HeroInfo[] }
  | {
      status: "ok";
      heroes: HeroInfo[];
      hero: HeroInfo;
      /** Posisi yang dipakai. Kalau user memilih "semua posisi", ini posisi utama hero. */
      position: number;
      bracketLabel: string;
      advice: Advice;
      plan: GamePlan;
      /** Data build dari STRATZ belum tersedia untuk hero/posisi/bracket ini. */
      missingBuild: boolean;
    };

export async function loadLivePlan(state: LiveState): Promise<LivePlan> {
  const heroes = await getHeroes();
  const hero = state.hero ? heroes.find((h) => h.id === state.hero) : undefined;
  if (!hero) return { status: "no-hero", heroes };

  let position = state.position;
  if (!position) {
    const rows = (await getPositions(state.bracket)) ?? [];
    const mine = rows
      .filter((r) => r.heroId === hero.id)
      .sort((a, b) => b.matchCount - a.matchCount);
    position = mine[0]?.position ?? 1;
  }

  const allies = [hero.id, ...state.allies];
  const everyone = [...allies, ...state.enemies];
  const [build, profiles, items, abilities, durationList] = await Promise.all([
    getItemBuild(hero.id, position, state.bracket),
    getProfiles(state.bracket),
    getItemInfo(),
    getAbilityInfo().catch((err) => {
      console.warn("[live] ability info failed", err);
      return new Map<string, AbilityInfo>();
    }),
    Promise.all(everyone.map((id) => getDurations(id).catch(() => null))),
  ]);

  const heroNames = new Map(heroes.map((h) => [h.id, h.name]));
  const durations = new Map<number, DurationBin[]>();
  everyone.forEach((id, i) => {
    const bins = durationList[i];
    if (bins) durations.set(id, bins);
  });

  const advice = advise({
    heroId: hero.id,
    position,
    enemies: state.enemies,
    state: state.state,
    owned: state.owned,
    build,
    profiles,
    traits,
    rules,
    items,
    heroNames,
  });
  const plan = buildGamePlan({
    allies,
    enemies: state.enemies,
    state: state.state,
    durations,
    traits,
    abilities,
    heroNames,
  });

  return {
    status: "ok",
    heroes,
    hero,
    position,
    bracketLabel: bracketGroupLabel(state.bracket),
    advice,
    plan,
    missingBuild: !build,
  };
}
