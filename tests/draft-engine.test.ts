import { describe, expect, it } from "vitest";
import type { HeroInfo } from "@/lib/dota";
import {
  compositionWarnings,
  metaScore,
  positionShare,
  recommend,
  type DraftData,
  type DraftInput,
  type HeroMatchupTable,
  type PositionStat,
} from "@/lib/draft/engine";

function hero(id: number, name: string, roles: string[] = []): HeroInfo {
  return {
    id,
    name,
    key: `npc_dota_hero_${name.toLowerCase()}`,
    img: "",
    icon: "",
    roles,
    primaryAttr: "agi",
    attackType: "Melee",
  };
}

/** Lima posisi; `mainPos` mendapat hampir semua game. */
function positions(mainPos: number, winRate = 0.5, matches = 10_000): PositionStat[] {
  return Array.from({ length: 5 }, (_, i) => {
    const m = i + 1 === mainPos ? matches : Math.round(matches * 0.01);
    return { matches: m, wins: Math.round(m * winRate) };
  });
}

function table(
  vs: Record<number, number> = {},
  withAllies: Record<number, number> = {},
): HeroMatchupTable {
  const toMap = (o: Record<number, number>) =>
    new Map(Object.entries(o).map(([id, synergy]) => [Number(id), { synergy, matchCount: 5000 }]));
  return { vs: toMap(vs), with: toMap(withAllies) };
}

const HEROES = [
  hero(1, "Alpha", ["Carry"]),
  hero(2, "Bravo", ["Carry", "Escape"]),
  hero(3, "Charlie", ["Support", "Disabler"]),
  hero(4, "Delta", ["Support"]),
  hero(5, "Echo", ["Carry"]),
  hero(6, "Foxtrot", ["Initiator", "Disabler"]),
];

function baseData(overrides: Partial<DraftData> = {}): DraftData {
  return {
    heroes: HEROES,
    positions: new Map([
      [1, positions(1)],
      [2, positions(1)],
      [3, positions(5)],
      [4, positions(5)],
      [5, positions(1)],
      [6, positions(3)],
    ]),
    matchups: new Map(),
    ...overrides,
  };
}

const input = (patch: Partial<DraftInput> = {}): DraftInput => ({
  allies: [],
  enemies: [],
  bans: [],
  position: 0,
  poolOnly: false,
  bracketLabel: "all ranks",
  ...patch,
});

describe("recommend", () => {
  it("never suggests heroes that are already picked or banned", () => {
    const result = recommend(input({ allies: [1], enemies: [2], bans: [3] }), baseData());
    const ids = result.picks.map((p) => p.heroId);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
  });

  it("ranks the hero that counters the enemy first", () => {
    // Enemy Bravo loses badly to Echo (from Bravo's side: -6pp) and beats Alpha (+4pp).
    const data = baseData({ matchups: new Map([[2, table({ 5: -6, 1: 4 })]]) });
    const result = recommend(input({ enemies: [2] }), data);
    const ids = result.picks.map((p) => p.heroId);
    expect(ids[0]).toBe(5);
    expect(ids.indexOf(5)).toBeLessThan(ids.indexOf(1));
    expect(result.picks[0].reasons.some((r) => r.text.startsWith("Strong against Bravo"))).toBe(
      true,
    );
    const alpha = result.picks.find((p) => p.heroId === 1)!;
    expect(alpha.reasons.some((r) => r.kind === "weak")).toBe(true);
  });

  it("rewards synergy with allies", () => {
    const data = baseData({ matchups: new Map([[1, table({}, { 3: 5, 4: -2 })]]) });
    const result = recommend(input({ allies: [1] }), data);
    const charlie = result.picks.find((p) => p.heroId === 3)!;
    const delta = result.picks.find((p) => p.heroId === 4)!;
    expect(charlie.score).toBeGreaterThan(delta.score);
    expect(charlie.reasons.some((r) => r.kind === "synergy")).toBe(true);
  });

  it("filters heroes that are rarely played in the chosen position", () => {
    const result = recommend(input({ position: 5 }), baseData());
    const ids = result.picks.map((p) => p.heroId);
    expect(ids.sort()).toEqual([3, 4]);
  });

  it("limits to the hero pool when asked", () => {
    const pool = new Map([
      [5, { games: 40, wins: 25 }],
      [6, { games: 3, wins: 3 }],
    ]);
    const result = recommend(input({ poolOnly: true }), baseData({ pool }));
    expect(result.picks.map((p) => p.heroId)).toEqual([5]);
    expect(result.picks[0].reasons.some((r) => r.kind === "pool")).toBe(true);
  });

  it("gives a hero-pool bonus without filtering when the toggle is off", () => {
    const pool = new Map([[5, { games: 60, wins: 40 }]]);
    const withPool = recommend(input(), baseData({ pool }));
    const without = recommend(input(), baseData());
    const score = (r: typeof withPool, id: number) => r.picks.find((p) => p.heroId === id)!.score;
    expect(score(withPool, 5)).toBeGreaterThan(score(without, 5));
  });

  it("suggests banning heroes that beat our picks", () => {
    // Our Alpha loses to Bravo (-5pp from Alpha's side).
    const data = baseData({ matchups: new Map([[1, table({ 2: -5 })]]) });
    const result = recommend(input({ allies: [1] }), data);
    expect(result.bans[0].heroId).toBe(2);
    expect(result.bans[0].reasons[0].text).toContain("Beats your Alpha");
  });
});

describe("metaScore and positionShare", () => {
  it("pulls small samples towards 50%", () => {
    const tiny = metaScore([{ matches: 10, wins: 10 }], 0);
    const big = metaScore([{ matches: 10_000, wins: 5_600 }], 0);
    expect(tiny.pp).toBeLessThan(1);
    expect(big.pp).toBeGreaterThan(5);
  });

  it("returns the share of games in a position", () => {
    expect(positionShare(positions(2), 2)).toBeGreaterThan(0.9);
    expect(positionShare(positions(2), 5)).toBeLessThan(0.1);
    expect(positionShare(undefined, 1)).toBeNull();
    expect(positionShare(positions(2), 0)).toBeNull();
  });
});

describe("compositionWarnings", () => {
  it("warns about missing disables and too many cores", () => {
    const warnings = compositionWarnings([HEROES[0], HEROES[1], HEROES[4]], []);
    expect(warnings.join(" ")).toMatch(/no reliable disable/);
    expect(warnings.join(" ")).toMatch(/3 heroes that want a lot of farm/);
  });

  it("stays quiet for a balanced team", () => {
    expect(compositionWarnings([HEROES[0], HEROES[2], HEROES[5]], [])).toEqual([]);
  });
});
