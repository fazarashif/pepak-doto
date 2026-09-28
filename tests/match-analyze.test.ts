import { describe, expect, it } from "vitest";
import type { HeroInfo } from "@/lib/dota";
import { analyzeMatch, gradeFor, type AnalyzeContext } from "@/lib/match/analyze";
import type { Match, MatchPlayer } from "@/lib/opendota/types";

const heroes: HeroInfo[] = [
  {
    id: 1,
    name: "Anti-Mage",
    key: "npc_dota_hero_antimage",
    img: "",
    icon: "",
    roles: ["Carry"],
    primaryAttr: "agi",
    attackType: "Melee",
  },
  {
    id: 2,
    name: "Axe",
    key: "npc_dota_hero_axe",
    img: "",
    icon: "",
    roles: ["Initiator"],
    primaryAttr: "str",
    attackType: "Melee",
  },
];

const ctx: AnalyzeContext = {
  heroes: new Map(heroes.map((h) => [h.id, h])),
  heroesByKey: new Map(heroes.map((h) => [h.key, h])),
  items: {
    bfury: {
      id: 145,
      dname: "Battle Fury",
      img: "/bfury.png",
      cost: 4100,
      components: ["quelling_blade", "demon_edge"],
    },
    manta: {
      id: 147,
      dname: "Manta Style",
      img: "/manta.png",
      cost: 4650,
      components: ["yasha", "ultimate_orb"],
    },
    yasha: {
      id: 170,
      dname: "Yasha",
      img: "/yasha.png",
      cost: 2050,
      components: ["blade_of_alacrity"],
    },
    boots: { id: 29, dname: "Boots of Speed", img: "/boots.png", cost: 500, components: null },
  },
  itemIds: { "145": "bfury", "147": "manta", "29": "boots" },
  itemTimings: [
    { hero_id: 1, item: "bfury", time: 900, games: "300", wins: "180" },
    { hero_id: 1, item: "bfury", time: 1200, games: "300", wins: "150" },
    // Pembeli sangat lambat terlihat sering menang karena game panjang yang sudah unggul.
    { hero_id: 1, item: "bfury", time: 1800, games: "100", wins: "90" },
  ],
  assetUrl: (p) => `https://cdn.example${p ?? ""}`,
};

function bench(pct: number) {
  return { raw: 0, pct };
}

function player(overrides: Partial<MatchPlayer> = {}): MatchPlayer {
  return {
    player_slot: 0,
    account_id: 100,
    personaname: "Tester",
    hero_id: 1,
    isRadiant: true,
    win: 0,
    kills: 3,
    deaths: 9,
    assists: 4,
    last_hits: 300,
    denies: 10,
    gold_per_min: 450,
    xp_per_min: 500,
    net_worth: 15000,
    hero_damage: 12000,
    tower_damage: 500,
    hero_healing: 0,
    level: 20,
    rank_tier: 45,
    item_0: 145,
    item_1: 29,
    item_2: 0,
    item_3: 0,
    item_4: 0,
    item_5: 0,
    benchmarks: {
      gold_per_min: bench(0.2),
      last_hits_per_min: bench(0.3),
      xp_per_min: bench(0.4),
      hero_damage_per_min: bench(0.6),
      deaths_per_min: bench(0.1),
      kills_per_min: bench(0.5),
      assists_per_min: bench(0.5),
    },
    ...overrides,
  };
}

function match(p: MatchPlayer, extra: Partial<Match> = {}): Match {
  return {
    match_id: 42,
    duration: 2400,
    radiant_win: false,
    game_mode: 22,
    lobby_type: 7,
    start_time: 1_790_000_000,
    od_data: { has_parsed: false },
    players: [p, player({ player_slot: 128, isRadiant: false, hero_id: 2, win: 1 })],
    ...extra,
  };
}

describe("gradeFor", () => {
  it("maps percentiles to letters", () => {
    expect(gradeFor(0.9)).toBe("A");
    expect(gradeFor(0.6)).toBe("B");
    expect(gradeFor(0.3)).toBe("C");
    expect(gradeFor(0.1)).toBe("D");
  });
});

describe("analyzeMatch (not parsed)", () => {
  const report = analyzeMatch(match(player()), 0, ctx);

  it("grades from OpenDota percentiles without inverting deaths", () => {
    const g = Object.fromEntries(report.grades.map((x) => [x.key, x.letter]));
    expect(g).toMatchObject({ farming: "C", experience: "C", damage: "B", survival: "D" });
  });

  it("puts dying less and farming first for a core", () => {
    expect(report.player.role).toBe("core");
    expect(report.improvements.map((i) => i.title)).toEqual(["Die less", "Farm faster"]);
  });

  it("lists final items and explains what needs a parsed replay", () => {
    expect(report.items.map((i) => i.name)).toEqual(["Battle Fury", "Boots of Speed"]);
    expect(report.notes.join(" ")).toMatch(/replay to be parsed/);
    expect(report.laning).toBeNull();
  });

  it("doesn't tell a support to farm more", () => {
    const support = analyzeMatch(match(player({ last_hits: 20 })), 0, ctx);
    expect(support.player.role).toBe("support");
    expect(support.improvements.map((i) => i.title)).not.toContain("Farm faster");
    expect(support.grades.find((g) => g.key === "farming")?.relevant).toBe(false);
  });

  it("never claims better than 100%", () => {
    const top = analyzeMatch(
      match(player({ benchmarks: { gold_per_min: bench(1), last_hits_per_min: bench(1) } })),
      0,
      ctx,
    );
    expect(top.grades[0].detail).toContain("99%");
  });
});

describe("analyzeMatch (parsed)", () => {
  const parsedPlayer = player({
    lane: 1,
    lane_role: 1,
    position_est: 1,
    lh_t: Array.from({ length: 41 }, (_, i) => i * 3),
    dn_t: Array.from({ length: 41 }, () => 2),
    gold_t: Array.from({ length: 41 }, (_, i) => i * 300),
    lane_efficiency_pct: 60,
    teamfight_participation: 0.4,
    deaths_log: [
      { time: 700, key: "npc_dota_hero_axe", time_dead: 30, gold_lost: 200 },
      { time: 800, key: "npc_dota_hero_axe", time_dead: 32, gold_lost: 150 },
      { time: 1900, key: "npc_dota_hero_axe", time_dead: 60, gold_lost: 400 },
    ],
    killed_by: { npc_dota_hero_axe: 3 },
    first_purchase_time: { yasha: 900, manta: 1500, bfury: 1100 },
    obs_placed: 0,
    sen_placed: 1,
  });
  const enemy = player({
    player_slot: 128,
    isRadiant: false,
    hero_id: 2,
    lane: 1,
    gold_t: Array.from({ length: 41 }, (_, i) => i * 450),
  });
  const report = analyzeMatch(
    match(parsedPlayer, { od_data: { has_parsed: true }, players: [parsedPlayer, enemy] }),
    0,
    ctx,
  );

  it("reports the lane at 10 minutes against the same lane", () => {
    expect(report.laning).toMatchObject({ lh10: 30, dn10: 2, goldDiff10: -1500, target: 50 });
  });

  it("groups deaths by phase and finds the main killer", () => {
    expect(report.deaths?.byPhase.map((p) => p.count)).toEqual([0, 2, 0, 1]);
    expect(report.deaths?.topKillers[0]).toEqual({ heroId: 2, count: 3 });
    expect(report.deaths?.goldLost).toBe(750);
  });

  it("only compares item timings with earlier buckets", () => {
    const bf = report.itemTimings.find((t) => t.item.key === "bfury")!;
    // Bought at 18:20 -> bucket "by 20:00" (50%). The 90% at 30:00 must be ignored.
    expect(bf.yourBucket).toBe("by 20:00");
    expect(bf.bestBucket).toBe("by 15:00");
    expect(bf.bestWinRate).toBeCloseTo(0.6);
  });

  it("skips components when the full item was bought", () => {
    expect(report.itemTimings.map((t) => t.item.key)).not.toContain("yasha");
  });

  it("mentions the killer in the survival advice", () => {
    const die = report.improvements.find((i) => i.title === "Die less");
    expect(die?.detail).toMatch(/Axe killed you 3 times/);
  });
});
