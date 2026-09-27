import "server-only";
import { assetUrl, type HeroInfo } from "@/lib/dota";
import { opendota } from "@/lib/opendota/client";
import type { HeroStat } from "@/lib/opendota/types";

export function toHeroInfo(h: HeroStat): HeroInfo {
  return {
    id: h.id,
    name: h.localized_name,
    key: h.name,
    img: assetUrl(h.img),
    icon: assetUrl(h.icon),
    roles: h.roles,
    primaryAttr: h.primary_attr,
    attackType: h.attack_type,
  };
}

export async function getHeroes(): Promise<HeroInfo[]> {
  const stats = await opendota.heroStats();
  return stats.map(toHeroInfo).sort((a, b) => a.name.localeCompare(b.name));
}

export interface HeroMeta {
  /** Index 0..7 = Herald..Immortal */
  brackets: { picks: number; wins: number }[];
  pro: { picks: number; wins: number; bans: number };
}

export interface HeroWithMeta extends HeroInfo {
  meta: HeroMeta;
}

export function toHeroMeta(h: HeroStat): HeroMeta {
  const brackets = Array.from({ length: 8 }, (_, i) => ({
    picks: h[`${i + 1}_pick`] ?? 0,
    wins: h[`${i + 1}_win`] ?? 0,
  }));
  const raw = h as unknown as Record<string, number | undefined>;
  return {
    brackets,
    pro: { picks: raw.pro_pick ?? 0, wins: raw.pro_win ?? 0, bans: raw.pro_ban ?? 0 },
  };
}

export async function getHeroesWithMeta(): Promise<HeroWithMeta[]> {
  const stats = await opendota.heroStats();
  return stats
    .map((h) => ({ ...toHeroInfo(h), meta: toHeroMeta(h) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Hero paling sering dipakai di semua rank, untuk tampilan beranda. */
export async function getMostPickedHeroes(limit: number): Promise<HeroInfo[]> {
  const stats = await opendota.heroStats();
  const totalPicks = (h: HeroStat) =>
    Array.from({ length: 8 }, (_, i) => h[`${i + 1}_pick`] ?? 0).reduce((a, b) => a + b, 0);
  return [...stats]
    .sort((a, b) => totalPicks(b) - totalPicks(a))
    .slice(0, limit)
    .map(toHeroInfo);
}
