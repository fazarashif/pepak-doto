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
