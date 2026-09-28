import { describe, expect, it } from "vitest";
import type { DurationBin, ItemBuild } from "@/lib/hero-data/types";
import {
  advise,
  phaseFor,
  roleFor,
  teamDamage,
  type CounterRulesFile,
  type ItemInfo,
} from "@/lib/items/advisor";
import type { HeroTraitsFile } from "@/lib/items/traits";
import { buildGamePlan, heroStrength } from "@/lib/plan/game-plan";
import type { HeroProfile } from "@/lib/stratz/api";

const item = (id: number, key: string, cost: number, extra: Partial<ItemInfo> = {}): ItemInfo => ({
  id,
  key,
  name: key,
  cost,
  components: [],
  ...extra,
});

const items = new Map(
  [
    item(44, "tango", 90, { qual: "consumable" }),
    item(36, "magic_wand", 460),
    item(63, "power_treads", 1400),
    item(1, "ogre_axe", 1000, { qual: "component" }),
    item(116, "black_king_bar", 4050, { components: ["ogre_axe", "mithril_hammer"] }),
    item(145, "bfury", 3900),
    item(147, "manta", 4650),
    item(135, "monkey_king_bar", 5000),
    item(250, "bloodthorn", 6400),
    item(249, "silver_edge", 5700),
    item(254, "glimmer_cape", 2150),
    item(90, "pipe", 3725),
  ].map((i) => [i.key, i]),
);

const build: ItemBuild = {
  games: 1000,
  starting: [{ itemId: 44, count: 2, matches: 900, wins: 450 }],
  boots: [{ itemId: 63, matches: 800, wins: 420, avgTime: 600 }],
  items: [
    { itemId: 36, matches: 700, wins: 360, medianMinute: 6, timing: [] },
    {
      itemId: 145,
      matches: 950,
      wins: 500,
      medianMinute: 15,
      timing: [
        [14, 400, 230],
        [16, 550, 270],
      ],
    },
    { itemId: 1, matches: 500, wins: 250, medianMinute: 18, timing: [] },
    { itemId: 147, matches: 800, wins: 440, medianMinute: 21, timing: [] },
    { itemId: 116, matches: 600, wins: 310, medianMinute: 27, timing: [] },
    // jarang dibeli: disembunyikan
    { itemId: 135, matches: 30, wins: 20, medianMinute: 30, timing: [] },
  ],
};

const traits: HeroTraitsFile = {
  patch: "test",
  reviewed: "test",
  heroes: {
    "44": { name: "Phantom Assassin", traits: ["evasion", "passives"], dangerous: ["pa_coup"] },
    "21": { name: "Windranger", traits: ["evasion"], dangerous: ["wr_shackle"] },
    "25": { name: "Lina", traits: [], dangerous: ["lina_laguna"] },
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
      items: { core: ["monkey_king_bar", "bloodthorn"], offlane: [], support: [] },
    },
    {
      id: "passives",
      when: { trait: "passives" },
      how: "Break turns off their passive abilities.",
      items: { core: ["silver_edge"], offlane: ["silver_edge"], support: [] },
    },
    {
      id: "magicHeavy",
      when: { stat: "magicShare", min: 0.56 },
      how: "Most of their damage is magic.",
      items: { core: ["black_king_bar"], offlane: ["pipe"], support: ["glimmer_cape"] },
    },
  ],
};

const profile = (heroId: number, physicalDamage: number, magicalDamage: number): HeroProfile => ({
  heroId,
  matchCount: 1000,
  physicalDamage,
  magicalDamage,
  pureDamage: 0,
  stunDuration: 0,
  disableDuration: 0,
  healingSelf: 0,
  healingAllies: 0,
  invisibleCount: 0,
});

const heroNames = new Map([
  [1, "Anti-Mage"],
  [44, "Phantom Assassin"],
  [21, "Windranger"],
  [25, "Lina"],
]);

const base = {
  heroId: 1,
  position: 1,
  enemies: [44, 21],
  state: "even" as const,
  owned: [],
  build,
  profiles: [profile(44, 900, 100), profile(21, 500, 500), profile(25, 100, 900)],
  traits,
  rules,
  items,
  heroNames,
};

describe("roles and phases", () => {
  it("maps positions to roles", () => {
    expect([1, 2, 3, 4, 5, 0].map(roleFor)).toEqual([
      "core",
      "core",
      "offlane",
      "support",
      "support",
      "core",
    ]);
  });

  it("splits the game at minute 12 and 25", () => {
    expect([10, 12, 13, 25, 26].map(phaseFor)).toEqual(["early", "early", "mid", "mid", "late"]);
  });
});

describe("advise: core build", () => {
  const advice = advise(base);

  it("puts items in phases and hides consumables, boots, rare items and components", () => {
    expect(advice.phases.early.map((e) => e.item.key)).toEqual(["magic_wand"]);
    expect(advice.phases.mid.map((e) => e.item.key)).toEqual(["bfury", "manta"]);
    expect(advice.phases.late.map((e) => e.item.key)).toEqual(["black_king_bar"]);
    expect(advice.boots.map((e) => e.item.key)).toEqual(["power_treads"]);
    expect(advice.starting).toEqual([{ item: items.get("tango"), count: 2, share: 0.9 }]);
  });

  it("compares win rates for on-time and late purchases", () => {
    const bf = advice.phases.mid[0];
    expect(bf.onTimeWinRate).toBeCloseTo(230 / 400);
    expect(bf.lateWinRate).toBeCloseTo(270 / 550);
  });

  it("marks owned items", () => {
    const owned = advise({ ...base, owned: [145] });
    expect(owned.phases.mid[0].owned).toBe(true);
  });
});

describe("advise: situational items", () => {
  it("explains counters with the enemy heroes that trigger them", () => {
    const { situational } = advise(base);
    expect(situational[0].item.key).toBe("monkey_king_bar");
    expect(situational[0].reasons[0]).toBe(
      "Phantom Assassin and Windranger have evasion. True Strike ignores evasion.",
    );
    const silver = situational.find((s) => s.item.key === "silver_edge");
    expect(silver?.reasons[0]).toMatch(/^Phantom Assassin relies on passive abilities\./);
  });

  it("uses the role's item list", () => {
    const support = advise({ ...base, position: 5, enemies: [25, 21] });
    expect(support.situational.map((s) => s.item.key)).toContain("glimmer_cape");
    expect(support.situational.map((s) => s.item.key)).not.toContain("monkey_king_bar");
  });

  it("adds damage-based items when the enemy team is mostly magic", () => {
    const mixed = advise({ ...base, enemies: [25, 21] });
    const bkb = mixed.situational.find((s) => s.item.key === "black_king_bar");
    expect(bkb?.reasons[0]).toBe("Most of their damage is magic. (70% of their damage)");
    expect(bkb?.inBuild).toBe(true);
  });

  it("moves owned items to the end", () => {
    const { situational } = advise({ ...base, owned: [135] });
    expect(situational.at(-1)?.item.key).toBe("monkey_king_bar");
    expect(situational.at(-1)?.owned).toBe(true);
  });

  it("prefers defensive items when behind", () => {
    // Dua hero dengan evasion (MKB) melawan tim yang 70% damage-nya magic (BKB).
    const input = {
      ...base,
      enemies: [44, 21, 25],
      profiles: [profile(44, 900, 100), profile(21, 0, 1000), profile(25, 0, 1000)],
    };
    const even = advise(input).situational.map((s) => s.item.key);
    const behind = advise({ ...input, state: "behind" }).situational.map((s) => s.item.key);
    expect(even.indexOf("monkey_king_bar")).toBeLessThan(even.indexOf("black_king_bar"));
    expect(behind.indexOf("black_king_bar")).toBeLessThan(behind.indexOf("monkey_king_bar"));
  });
});

describe("teamDamage", () => {
  it("returns damage shares for the enemy team", () => {
    const mix = teamDamage([44, 25], base.profiles);
    expect(mix?.physical).toBeCloseTo(0.5);
    expect(mix?.magical).toBeCloseTo(0.5);
  });

  it("returns null without data", () => {
    expect(teamDamage([44], null)).toBeNull();
  });
});

// Hero yang kuat di game panjang: kalah di menit awal, menang di menit akhir.
const lateHero: DurationBin[] = [
  [15, 1000, 350],
  [20, 1000, 400],
  [25, 1000, 450],
  [30, 1000, 500],
  [35, 1000, 550],
  [40, 1000, 600],
  [45, 1000, 620],
  [50, 1000, 640],
];
const earlyHero: DurationBin[] = lateHero.map(([m, n, w]) => [m, n, n - w]);

describe("heroStrength", () => {
  it("is negative early and positive late for a late-game hero", () => {
    const s = heroStrength(lateHero);
    expect(s.get(15)).toBeLessThan(-0.1);
    expect(s.get(50)).toBeGreaterThan(0.1);
  });

  it("pulls empty bins to zero", () => {
    expect(heroStrength(lateHero).get(60)).toBeCloseTo(0);
  });
});

describe("buildGamePlan", () => {
  const abilities = new Map([
    ["pa_coup", { key: "pa_coup", name: "Coup de Grace", bkbPierce: true }],
    ["wr_shackle", { key: "wr_shackle", name: "Shackleshot", bkbPierce: false }],
  ]);
  const plan = (allies: DurationBin[], enemies: DurationBin[], state = "even" as const) =>
    buildGamePlan({
      allies: [1],
      enemies: [44, 21],
      state,
      durations: new Map([
        [1, allies],
        [44, enemies],
        [21, enemies],
      ]),
      traits,
      abilities,
      heroNames,
    });

  it("tells an early lineup to fight early", () => {
    const p = plan(earlyHero, lateHero);
    expect(p.timing).toBe("early");
    // Di menit 30 hero awal masih di atas winrate rata-ratanya, jadi keunggulan berpindah di 35.
    expect(p.switchMinute).toBe(35);
    expect(p.summary).toMatch(/until about minute 35/);
  });

  it("tells a late lineup to play safe", () => {
    expect(plan(lateHero, earlyHero).timing).toBe("late");
  });

  it("calls it even when both lineups peak together", () => {
    expect(plan(lateHero, lateHero).timing).toBe("even");
  });

  it("lists the enemy abilities to watch", () => {
    const p = plan(lateHero, lateHero);
    expect(p.dangers.map((d) => [d.heroName, d.abilities.map((a) => a.name)])).toEqual([
      ["Phantom Assassin", ["Coup de Grace"]],
      ["Windranger", ["Shackleshot"]],
    ]);
  });

  it("only flags BKB-piercing abilities for heroes checked to have such disables", () => {
    // Coup de Grace ditandai "menembus BKB" di data OpenDota, tapi PA tidak punya trait bkbPierce.
    const coup = plan(lateHero, lateHero).dangers[0].abilities[0];
    expect(coup.bkbPierce).toBe(false);
  });

  it("adds a tip when behind", () => {
    expect(plan(lateHero, lateHero, "behind" as never).stateTip).toMatch(/You're behind/);
  });
});
