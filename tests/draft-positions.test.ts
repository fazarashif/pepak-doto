import { describe, expect, it } from "vitest";
import { buildVsMatrix } from "@/lib/draft/matrix";
import {
  assignPositions,
  bestOpenPosition,
  laneOpponents,
  type PositionShares,
} from "@/lib/draft/positions";
import { parseRound, parseSlotList, toSearchParams, type DraftState } from "@/lib/draft/types";
import { initials, matchRank, searchHeroes } from "@/lib/hero-search";

const shares: PositionShares = new Map([
  [1, [0.9, 0.05, 0.05, 0, 0]], // carry
  [2, [0.5, 0.5, 0, 0, 0]], // carry atau mid
  [3, [0, 0, 0, 0.5, 0.5]], // support
  [4, [0, 0, 0, 0.4, 0.6]], // hard support
  [5, [0, 0.1, 0.9, 0, 0]], // offlane
]);

describe("assignPositions", () => {
  it("picks the most likely combination for the whole team", () => {
    const result = assignPositions([2, 1, 4, 3, 5], shares);
    expect(Object.fromEntries(result)).toEqual({ 1: 1, 2: 2, 3: 4, 4: 5, 5: 3 });
  });

  it("keeps positions the user set and fits the rest around them", () => {
    const result = assignPositions([1, 2], shares, new Map([[2, 1]]));
    expect(result.get(2)).toBe(1);
    expect(result.get(1)).not.toBe(1);
  });

  it("ignores a fixed position that another hero already holds", () => {
    const result = assignPositions(
      [1, 2],
      shares,
      new Map([
        [1, 1],
        [2, 1],
      ]),
    );
    expect(result.get(1)).toBe(1);
    expect(result.get(2)).not.toBe(1);
  });
});

describe("lanes and open positions", () => {
  it("knows who meets whom in lane", () => {
    expect(laneOpponents(1)).toEqual([3, 4]);
    expect(laneOpponents(4)).toEqual([1, 5]);
    expect(laneOpponents(2)).toEqual([2]);
  });

  it("puts a new hero in the open position it plays most", () => {
    expect(bestOpenPosition(4, [1, 4, 5], shares)).toBe(5);
    expect(bestOpenPosition(4, [1, 4], shares)).toBe(4);
    expect(bestOpenPosition(4, [], shares)).toBeNull();
  });
});

describe("buildVsMatrix", () => {
  it("flips the enemy's view and shrinks small samples", () => {
    // Hero 2's table: it beats hero 1 by 4pp over 300 games.
    const matrix = buildVsMatrix([[2, [[1, 300, 4]]]]);
    expect(matrix[1][2]).toBe(-2);
  });
});

describe("draft URL", () => {
  it("reads heroes with optional positions and drops duplicates", () => {
    expect(parseSlotList("14,8:3,14,9:3,abc", 5)).toEqual([
      { heroId: 14, position: 0 },
      { heroId: 8, position: 3 },
      { heroId: 9, position: 0 },
    ]);
    expect(parseRound("2")).toBe(2);
    expect(parseRound("7")).toBe(1);
  });

  it("writes allies by position and enemy positions only when set", () => {
    const state: DraftState = {
      allies: [0, 0, 0, 0, 26],
      enemies: [14, 8],
      enemyPos: [0, 3],
      bans: [],
      bracket: 5,
      position: 5,
      round: 2,
      poolOnly: false,
    };
    const params = toSearchParams(state);
    expect(params.get("a")).toBe("26:5");
    expect(params.get("e")).toBe("14,8:3");
    expect(params.get("rd")).toBe("2");
  });
});

describe("hero search", () => {
  const heroes = [
    { name: "Anti-Mage" },
    { name: "Crystal Maiden" },
    { name: "Faceless Void" },
    { name: "Keeper of the Light" },
    { name: "Void Spirit" },
    { name: "Windranger" },
  ];

  it("builds initials from multi-word names", () => {
    expect(initials("Keeper of the Light")).toBe("kotl");
    expect(initials("Anti-Mage")).toBe("am");
    expect(initials("Windranger")).toBe("");
  });

  it("matches initials, nicknames and parts of names", () => {
    expect(searchHeroes(heroes, "cm")[0].name).toBe("Crystal Maiden");
    expect(searchHeroes(heroes, "wr")[0].name).toBe("Windranger");
    expect(searchHeroes(heroes, "antimage")[0].name).toBe("Anti-Mage");
    expect(searchHeroes(heroes, "void").map((h) => h.name)).toEqual([
      "Faceless Void",
      "Void Spirit",
    ]);
    expect(matchRank({ name: "Crystal Maiden" }, "zzz")).toBeNull();
  });

  it("puts the start of a name ahead of a match in the middle", () => {
    expect(searchHeroes([{ name: "Slardar" }, { name: "Dark Seer" }], "ar")[0].name).toBe(
      "Slardar",
    );
    expect(searchHeroes([{ name: "Slardar" }, { name: "Dark Seer" }], "da")[0].name).toBe(
      "Dark Seer",
    );
  });
});
