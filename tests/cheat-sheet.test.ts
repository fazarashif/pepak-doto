import { describe, expect, it } from "vitest";
import type { CounterRulesFile, ItemInfo } from "@/lib/items/advisor";
import type { HeroTraitsFile } from "@/lib/items/traits";
import { buildCheatSheet } from "@/lib/plan/cheat-sheet";

const item = (id: number, key: string, cost: number): ItemInfo => ({
  id,
  key,
  name: key,
  cost,
  components: [],
});
const items = new Map(
  [
    item(135, "monkey_king_bar", 5000),
    item(249, "silver_edge", 5700),
    item(116, "black_king_bar", 4050),
    item(145, "bfury", 3900),
    item(36, "magic_wand", 460),
  ].map((i) => [i.key, i]),
);

const traits: HeroTraitsFile = {
  patch: "test",
  reviewed: "test",
  heroes: {
    "44": {
      name: "Phantom Assassin",
      traits: ["evasion"],
      dangerous: ["pa_coup"],
    },
  },
};

const rules: CounterRulesFile = {
  patch: "test",
  reviewed: "test",
  rules: [
    {
      id: "evasion",
      when: { trait: "evasion" },
      how: "True Strike ignores evasion.",
      items: { core: ["monkey_king_bar"], offlane: [], support: [] },
    },
    {
      id: "passives",
      when: { trait: "passives" },
      how: "Break turns off their passive abilities.",
      items: { core: ["silver_edge"], offlane: [], support: [] },
    },
    {
      id: "physicalHeavy",
      when: { stat: "physicalShare", min: 0.55 },
      how: "Most of their damage comes from right-clicks.",
      items: { core: [], offlane: ["black_king_bar"], support: [] },
    },
  ],
};

const sheet = buildCheatSheet({
  heroId: 44,
  heroName: "Phantom Assassin",
  matchups: {
    with: [],
    // [lawan, jumlah match, keunggulan PA]
    vs: [
      [71, 5000, -4],
      [2, 800, -5],
      [35, 5000, 3],
      [1, 50, -20], // terlalu sedikit match
    ],
  },
  profiles: [
    {
      heroId: 44,
      matchCount: 1000,
      physicalDamage: 900,
      magicalDamage: 100,
      pureDamage: 0,
      stunDuration: 0,
      disableDuration: 0,
      healingSelf: 0,
      healingAllies: 0,
      invisibleCount: 0,
    },
  ],
  durations: [
    [20, 1000, 400],
    [40, 1000, 600],
  ],
  build: {
    games: 1000,
    starting: [],
    boots: [],
    items: [
      { itemId: 36, matches: 900, wins: 450, medianMinute: 5, timing: [] },
      { itemId: 145, matches: 950, wins: 500, medianMinute: 15, timing: [] },
    ],
  },
  traits,
  rules,
  items,
  abilities: new Map([["pa_coup", { key: "pa_coup", name: "Coup de Grace", bkbPierce: true }]]),
});

describe("buildCheatSheet", () => {
  it("ranks counters by adjusted edge and skips thin samples", () => {
    expect(sheet.counters.map((c) => c.heroId)).toEqual([71, 2]);
    expect(sheet.counters[0].advantage).toBeCloseTo(4 * (5000 / 5300));
    expect(sheet.goodAgainst.map((c) => c.heroId)).toEqual([35]);
  });

  it("picks counter items from the hero's traits and damage type", () => {
    expect(sheet.counterItems.map((g) => g.reason)).toEqual([
      "Phantom Assassin has evasion. True Strike ignores evasion.",
      "90% of Phantom Assassin's damage is physical.",
    ]);
    expect(sheet.counterItems[0].items.core.map((i) => i.key)).toEqual(["monkey_king_bar"]);
  });

  it("does not flag physical abilities as BKB-piercing disables", () => {
    expect(sheet.dangerous).toEqual([{ key: "pa_coup", name: "Coup de Grace", bkbPierce: false }]);
  });

  it("finds the peak game length and key items", () => {
    expect(sheet.peakMinute).toBe(40);
    expect(sheet.keyItems.map((k) => k.item.key)).toEqual(["bfury"]);
  });
});
