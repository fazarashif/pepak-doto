// Sifat hero yang tidak bisa dibaca dari statistik, dipakai untuk memilih item counter.
// Datanya di data/hero-traits.json (disunting manual tiap patch, drafnya dari
// scripts/draft-hero-traits.ts).

export const HERO_TRAITS = [
  "illusions",
  "summons",
  "evasion",
  "heal",
  "invisibility",
  "silence",
  "escape",
  "dispellableBuffs",
  "passives",
  "bkbPierce",
] as const;

export type HeroTrait = (typeof HERO_TRAITS)[number];

/** Dipakai di kalimat alasan, mis. "Phantom Assassin has evasion". */
export const TRAIT_PHRASE: Record<HeroTrait, string> = {
  illusions: "makes illusions",
  summons: "fights with summoned units",
  evasion: "has evasion",
  heal: "heals a lot",
  invisibility: "can turn invisible",
  silence: "has silences",
  escape: "is hard to catch",
  dispellableBuffs: "relies on buffs that can be dispelled",
  passives: "relies on passive abilities",
  bkbPierce: "has disables that go through BKB",
};

export interface HeroTraitEntry {
  name: string;
  traits: HeroTrait[];
  /** Ability key (dotaconstants) yang paling perlu diwaspadai. */
  dangerous: string[];
}

export interface HeroTraitsFile {
  patch: string;
  reviewed: string;
  heroes: Record<string, HeroTraitEntry>;
}
