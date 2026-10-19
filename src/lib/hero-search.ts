// Pencarian hero untuk input cepat saat draft: nama, singkatan dari huruf depan
// ("am", "cm", "kotl") dan nama panggilan yang biasa dipakai pemain.

import type { HeroInfo } from "@/lib/dota";

/** Nama panggilan di luar singkatan huruf depan, dikelompokkan per nama hero. */
const NICKNAMES: Record<string, string[]> = {
  "Anti-Mage": ["magina"],
  Axe: ["mogul"],
  Bloodseeker: ["bs", "seeker"],
  "Crystal Maiden": ["rylai"],
  "Drow Ranger": ["traxex"],
  Earthshaker: ["es", "shaker"],
  Juggernaut: ["jugg"],
  Mirana: ["potm"],
  Morphling: ["morph"],
  "Shadow Fiend": ["nevermore"],
  "Phantom Lancer": ["lancer"],
  "Sand King": ["crixalis"],
  "Storm Spirit": ["storm"],
  "Vengeful Spirit": ["venge"],
  Windranger: ["wr", "windrunner"],
  "Shadow Shaman": ["rhasta"],
  Tidehunter: ["tide"],
  Necrophos: ["necro"],
  Warlock: ["wl"],
  Beastmaster: ["bm"],
  "Queen of Pain": ["qop"],
  Venomancer: ["veno"],
  "Faceless Void": ["void", "fv"],
  "Wraith King": ["skeleton king"],
  "Death Prophet": ["dp"],
  "Phantom Assassin": ["mortred"],
  "Templar Assassin": ["lanaya"],
  "Dragon Knight": ["davion"],
  Clockwerk: ["clock", "cw"],
  Leshrac: ["lesh"],
  "Nature's Prophet": ["furion", "np"],
  Lifestealer: ["naix", "ls"],
  "Dark Seer": ["ds"],
  Omniknight: ["omni"],
  Enchantress: ["ench"],
  "Night Stalker": ["balanar"],
  Broodmother: ["brood"],
  Batrider: ["bat"],
  Spectre: ["spec"],
  "Ancient Apparition": ["aa"],
  "Spirit Breaker": ["bara", "sb"],
  Gyrocopter: ["gyro"],
  Alchemist: ["alch"],
  Invoker: ["invo", "voker"],
  "Outworld Devourer": ["od", "outworld destroyer"],
  Brewmaster: ["brew", "panda"],
  "Lone Druid": ["ld", "syllabear"],
  "Chaos Knight": ["ck"],
  "Treant Protector": ["treant", "tree"],
  "Ogre Magi": ["ogre"],
  Disruptor: ["disr"],
  "Nyx Assassin": ["nyx"],
  "Naga Siren": ["naga"],
  "Keeper of the Light": ["kotl", "ezalor"],
  Io: ["wisp"],
  Medusa: ["dusa"],
  "Troll Warlord": ["troll"],
  "Centaur Warrunner": ["centaur", "cent"],
  Magnus: ["mag"],
  Timbersaw: ["timber"],
  Bristleback: ["bb", "bristle"],
  "Skywrath Mage": ["sky"],
  Abaddon: ["abba"],
  "Legion Commander": ["legion"],
  "Ember Spirit": ["ember"],
  "Earth Spirit": ["kaolin"],
  Underlord: ["pit lord", "ul"],
  Terrorblade: ["tb"],
  "Winter Wyvern": ["wyvern"],
  "Arc Warden": ["arc", "zet"],
  "Monkey King": ["mk"],
  "Dark Willow": ["willow"],
  Pangolier: ["pango"],
  Grimstroke: ["grim"],
  "Void Spirit": ["void"],
  Snapfire: ["snap"],
  Dawnbreaker: ["dawn"],
  "Primal Beast": ["primal"],
  "Ring Master": ["ringmaster"],
};

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

function words(name: string) {
  return name
    .toLowerCase()
    .split(/[\s\-']+/)
    .filter(Boolean);
}

/** "Keeper of the Light" -> "kotl", "Anti-Mage" -> "am". Hero satu kata tidak punya singkatan. */
export function initials(name: string) {
  const w = words(name);
  return w.length > 1 ? w.map((x) => x[0]).join("") : "";
}

/**
 * Seberapa cocok hero dengan kata kunci. Angka kecil lebih cocok, null kalau tidak cocok:
 * 0 singkatan atau nama panggilan persis, 1 awal nama, 2 awal salah satu kata,
 * 3 awal nama panggilan, 4 ada di tengah nama.
 */
export function matchRank(hero: Pick<HeroInfo, "name">, query: string): number | null {
  const q = normalize(query);
  if (!q) return 4;
  const nicknames = (NICKNAMES[hero.name] ?? []).map(normalize);
  if (initials(hero.name) === q || nicknames.includes(q)) return 0;
  const name = normalize(hero.name);
  if (name.startsWith(q)) return 1;
  if (words(hero.name).some((w) => normalize(w).startsWith(q))) return 2;
  if (nicknames.some((n) => n.startsWith(q))) return 3;
  if (name.includes(q)) return 4;
  return null;
}

/** Hero yang cocok, yang paling cocok di depan. Tanpa kata kunci, urutan asli dipertahankan. */
export function searchHeroes<T extends Pick<HeroInfo, "name">>(heroes: T[], query: string): T[] {
  if (!normalize(query)) return heroes;
  return heroes
    .map((hero, index) => ({ hero, index, rank: matchRank(hero, query) }))
    .filter((x): x is { hero: T; index: number; rank: number } => x.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((x) => x.hero);
}
