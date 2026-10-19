import { describe, expect, it } from "vitest";
import type { HeroInfo } from "@/lib/dota";
import {
  compositionWarnings,
  laneCounter,
  metaScore,
  positionShare,
  recommend,
  type DraftData,
  type DraftInput,
  type DraftResult,
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
  round: 3,
  poolOnly: false,
  bracketLabel: "all ranks",
  ...patch,
});

/** Saran untuk satu posisi. */
function picksFor(result: DraftResult, position: number) {
  return result.picks.find((g) => g.position === position)?.suggestions ?? [];
}

const allPicks = (result: DraftResult) => result.picks.flatMap((g) => g.suggestions);

describe("recommend", () => {
  it("never suggests heroes that are already picked or banned", () => {
    const result = recommend(
      input({
        allies: [{ heroId: 1, position: 1 }],
        enemies: [{ heroId: 2, position: 1 }],
        bans: [3],
      }),
      baseData(),
    );
    const ids = allPicks(result).map((p) => p.heroId);
    expect(ids).not.toContain(1);
    expect(ids).not.toContain(2);
    expect(ids).not.toContain(3);
  });

  it("gives suggestions for every open position, with the user's position first", () => {
    const result = recommend(
      input({ position: 5, allies: [{ heroId: 1, position: 1 }] }),
      baseData(),
    );
    expect(result.picks.map((g) => g.position)).toEqual([5, 2, 3, 4]);
  });

  it("only suggests heroes that are usually played in that position", () => {
    const result = recommend(input(), baseData());
    expect(
      picksFor(result, 5)
        .map((p) => p.heroId)
        .sort(),
    ).toEqual([3, 4]);
    expect(picksFor(result, 3).map((p) => p.heroId)).toEqual([6]);
  });

  it("ranks the hero that counters the enemy first", () => {
    // Enemy Bravo loses badly to Echo (from Bravo's side: -6pp) and beats Alpha (+4pp).
    const data = baseData({ matchups: new Map([[2, table({ 5: -6, 1: 4 })]]) });
    const result = recommend(input({ enemies: [{ heroId: 2, position: 1 }] }), data);
    const carry = picksFor(result, 1);
    expect(carry[0].heroId).toBe(5);
    expect(carry[0].reasons.some((r) => r.text.startsWith("Strong against Bravo"))).toBe(true);
    const alpha = carry.find((p) => p.heroId === 1)!;
    expect(alpha.reasons.some((r) => r.kind === "weak")).toBe(true);
  });

  it("marks counters against a lane opponent", () => {
    // Bravo plays offlane for the enemy, which is the lane our carry faces.
    const data = baseData({ matchups: new Map([[2, table({ 5: -6 })]]) });
    const result = recommend(input({ enemies: [{ heroId: 2, position: 3 }] }), data);
    const echo = picksFor(result, 1).find((p) => p.heroId === 5)!;
    expect(echo.reasons.map((r) => r.text)).toContain("Strong against Bravo in lane (+5.7%)");
  });

  it("rewards synergy with allies", () => {
    const data = baseData({ matchups: new Map([[1, table({}, { 3: 5, 4: -2 })]]) });
    const result = recommend(input({ allies: [{ heroId: 1, position: 1 }] }), data);
    const support = picksFor(result, 5);
    const charlie = support.find((p) => p.heroId === 3)!;
    const delta = support.find((p) => p.heroId === 4)!;
    expect(charlie.score).toBeGreaterThan(delta.score);
    expect(charlie.reasons.some((r) => r.kind === "synergy")).toBe(true);
  });

  it("limits the user's own position to the hero pool when asked", () => {
    const pool = new Map([
      [5, { games: 40, wins: 25 }],
      [1, { games: 3, wins: 3 }],
    ]);
    const result = recommend(input({ position: 1, poolOnly: true }), baseData({ pool }));
    expect(picksFor(result, 1).map((p) => p.heroId)).toEqual([5]);
    expect(picksFor(result, 1)[0].reasons.some((r) => r.kind === "pool")).toBe(true);
    // Posisi teman tidak dibatasi hero pool user.
    expect(
      picksFor(result, 5)
        .map((p) => p.heroId)
        .sort(),
    ).toEqual([3, 4]);
  });

  it("gives a hero-pool bonus without filtering when the toggle is off", () => {
    const pool = new Map([[5, { games: 60, wins: 40 }]]);
    const withPool = recommend(input({ position: 1 }), baseData({ pool }));
    const without = recommend(input({ position: 1 }), baseData());
    const score = (r: DraftResult, id: number) =>
      picksFor(r, 1).find((p) => p.heroId === id)!.score;
    expect(score(withPool, 5)).toBeGreaterThan(score(without, 5));
  });

  it("does not use the user's hero pool for teammates", () => {
    const pool = new Map([[3, { games: 60, wins: 40 }]]);
    const result = recommend(input({ position: 1 }), baseData({ pool }));
    const charlie = picksFor(result, 5).find((p) => p.heroId === 3)!;
    expect(charlie.reasons.some((r) => r.kind === "pool")).toBe(false);
  });

  it("suggests banning heroes that beat our picks", () => {
    // Our Alpha loses to Bravo (-5pp from Alpha's side).
    const data = baseData({ matchups: new Map([[1, table({ 2: -5 })]]) });
    const result = recommend(input({ allies: [{ heroId: 1, position: 1 }] }), data);
    expect(result.bans[0].heroId).toBe(2);
    expect(result.bans[0].reasons[0].text).toContain("Beats your Alpha");
  });
});

describe("enemies who have not picked yet", () => {
  // Two offlaners: Foxtrot and the more popular Golf. Alpha loses to both (hard to Foxtrot),
  // Echo doesn't care about either.
  const vsMatrix = { 1: { 6: -5, 7: -2, 3: 0, 4: 0 }, 5: { 6: 0, 7: 0, 3: 0, 4: 0 } };
  const withGolf = (patch: Partial<DraftData> = {}) => {
    const data = baseData({ vsMatrix, ...patch });
    data.heroes = [...data.heroes, hero(7, "Golf", ["Initiator"])];
    data.positions.set(7, positions(3, 0.5, 20_000));
    return data;
  };

  it("ranks easy-to-counter heroes lower in round 1 than in round 3", () => {
    const data = withGolf();
    const gap = (round: 1 | 3) => {
      const carry = picksFor(recommend(input({ round }), data), 1);
      const s = (id: number) => carry.find((p) => p.heroId === id)!.score;
      return s(5) - s(1);
    };
    expect(gap(1)).toBeGreaterThan(0);
    expect(gap(1)).toBeGreaterThan(gap(3));
  });

  it("warns when a hero is easy to counter later", () => {
    const result = recommend(input({ round: 1 }), withGolf());
    const alpha = picksFor(result, 1).find((p) => p.heroId === 1)!;
    expect(alpha.reasons.map((r) => r.text)).toContain(
      "Easy to counter later, e.g. by Foxtrot (-5.0%)",
    );
    const echo = picksFor(result, 1).find((p) => p.heroId === 5)!;
    expect(echo.reasons.some((r) => r.kind === "blind")).toBe(true);
  });

  it("says nothing about later counters in the last round", () => {
    const result = recommend(input({ round: 3 }), withGolf());
    const reasons = allPicks(result).flatMap((p) => p.reasons);
    expect(reasons.some((r) => r.kind === "blind" || r.text.startsWith("Easy to counter"))).toBe(
      false,
    );
  });

  it("labels nobody when every hero is as easy to counter as the next", () => {
    const same = { 1: { 6: -5, 7: -2, 3: 0, 4: 0 }, 5: { 6: -5, 7: -2, 3: 0, 4: 0 } };
    const result = recommend(input({ round: 1 }), withGolf({ vsMatrix: same }));
    const reasons = allPicks(result).flatMap((p) => p.reasons);
    expect(reasons.some((r) => r.kind === "blind" || r.text.startsWith("Easy to counter"))).toBe(
      false,
    );
  });

  it("doesn't count heroes that are already taken as possible counters", () => {
    const result = recommend(input({ round: 1, bans: [6] }), withGolf());
    const alpha = picksFor(result, 1).find((p) => p.heroId === 1)!;
    expect(alpha.reasons.some((r) => r.text.includes("Foxtrot"))).toBe(false);
  });
});

describe("laneCounter", () => {
  it("weights lane opponents more than other enemies", () => {
    // Our carry (pos 1) beats the enemy mid but loses to the offlaner it faces in lane.
    const data = baseData({
      matchups: new Map([
        [2, table({ 5: -4 })],
        [6, table({ 5: 4 })],
      ]),
    });
    const enemies = [
      { heroId: 6, position: 3 },
      { heroId: 2, position: 2 },
    ];
    expect(laneCounter(5, 1, enemies, data)).toBeLessThan(0);
  });
});

describe("laneOutlook", () => {
  it("compares each lane and calls it tough when we lose the matchups", () => {
    const data = baseData({ matchups: new Map([[6, table({ 1: 3 })]]) });
    const result = recommend(
      input({
        allies: [{ heroId: 1, position: 1 }],
        enemies: [{ heroId: 6, position: 3 }],
      }),
      data,
    );
    expect(result.lanes).toHaveLength(1);
    expect(result.lanes[0]).toMatchObject({
      lane: "safe",
      allies: [1],
      enemies: [6],
      verdict: "tough",
    });
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
