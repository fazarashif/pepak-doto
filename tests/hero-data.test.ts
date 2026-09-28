import { describe, expect, it } from "vitest";
import { mainPositions, summarizeItems } from "@/lib/hero-data/types";
import type { RawHeroItems } from "@/lib/stratz/api";

const raw: RawHeroItems = {
  full: [
    // Battle Fury: dibeli semua pemain, menit 14-16
    { itemId: 145, time: 14, instance: 0, matchCount: 400, winCount: 220 },
    { itemId: 145, time: 15, instance: 0, matchCount: 500, winCount: 250 },
    { itemId: 145, time: 16, instance: 0, matchCount: 300, winCount: 130 },
    // pembelian kedua tidak dihitung
    { itemId: 145, time: 30, instance: 1, matchCount: 50, winCount: 30 },
    // Manta: sebagian besar pemain
    { itemId: 147, time: 20, instance: 0, matchCount: 600, winCount: 350 },
    { itemId: 147, time: 22, instance: 0, matchCount: 10, winCount: 5 },
    // Item langka (< 3%): dibuang
    { itemId: 999, time: 25, instance: 0, matchCount: 20, winCount: 10 },
  ],
  starting: [
    { itemId: 44, instance: 0, wasGiven: false, matchCount: 1100, winCount: 560 },
    { itemId: 44, instance: 1, wasGiven: false, matchCount: 900, winCount: 450 },
    { itemId: 44, instance: 1, wasGiven: true, matchCount: 300, winCount: 150 },
    { itemId: 16, instance: 0, wasGiven: false, matchCount: 50, winCount: 20 },
  ],
  boots: [
    { itemId: 63, matchCount: 1000, winCount: 500, timeAverage: 470.4 },
    { itemId: 50, matchCount: 5, winCount: 2, timeAverage: 600 },
  ],
};

describe("summarizeItems", () => {
  const build = summarizeItems(raw, 800);

  it("uses the largest count as the denominator so shares stay under 100%", () => {
    // Battle Fury dibeli 1.200 kali, lebih dari 800 match di statistik posisi
    expect(build.games).toBe(1200);
  });

  it("keeps first purchases only, sorted by usual timing", () => {
    expect(build.items.map((i) => i.itemId)).toEqual([145, 147]);
    const bf = build.items[0];
    expect(bf.matches).toBe(1200);
    expect(bf.wins).toBe(600);
    expect(bf.medianMinute).toBe(15);
  });

  it("drops timing points with too few matches", () => {
    const manta = build.items[1];
    expect(manta.timing).toEqual([[20, 600, 350]]);
  });

  it("counts starting items bought by the player, not given by teammates", () => {
    expect(build.starting).toEqual([{ itemId: 44, count: 2, matches: 1100, wins: 560 }]);
  });

  it("keeps common boots and rounds the average time", () => {
    expect(build.boots).toEqual([{ itemId: 63, matches: 1000, wins: 500, avgTime: 470 }]);
  });
});

describe("mainPositions", () => {
  const rows = [
    { heroId: 1, position: 1, matchCount: 900, winCount: 450 },
    { heroId: 1, position: 2, matchCount: 80, winCount: 40 },
    { heroId: 1, position: 3, matchCount: 120, winCount: 60 },
    { heroId: 2, position: 4, matchCount: 100, winCount: 50 },
  ];

  it("returns positions with at least 10% of the hero's games", () => {
    expect(mainPositions(rows, 1).map((p) => p.position)).toEqual([1, 3]);
  });

  it("returns nothing for an unknown hero", () => {
    expect(mainPositions(rows, 50)).toEqual([]);
  });
});
