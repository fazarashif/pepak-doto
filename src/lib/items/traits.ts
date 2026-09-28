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

/** Dipakai di kalimat alasan, mis. "Phantom Assassin has evasion" / "PA and WR have evasion". */
export const TRAIT_PHRASE: Record<HeroTrait, { one: string; many: string }> = {
  illusions: { one: "makes illusions", many: "make illusions" },
  summons: { one: "fights with summoned units", many: "fight with summoned units" },
  evasion: { one: "has evasion", many: "have evasion" },
  heal: { one: "heals a lot", many: "heal a lot" },
  invisibility: { one: "can turn invisible", many: "can turn invisible" },
  silence: { one: "has silences", many: "have silences" },
  escape: { one: "is hard to catch", many: "are hard to catch" },
  dispellableBuffs: {
    one: "relies on buffs that can be dispelled",
    many: "rely on buffs that can be dispelled",
  },
  passives: { one: "relies on passive abilities", many: "rely on passive abilities" },
  bkbPierce: { one: "has disables that go through BKB", many: "have disables that go through BKB" },
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
