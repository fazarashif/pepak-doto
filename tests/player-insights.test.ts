import { describe, expect, it } from "vitest";
import { goalProgress, goalText, type GoalInput } from "@/lib/players/goals";
import { buildHeroPool } from "@/lib/players/hero-pool";
import type { MatchSummary } from "@/lib/players/summary";
import { buildTrends } from "@/lib/players/trends";

let nextId = 1;
const match = (over: Partial<MatchSummary> = {}): MatchSummary => ({
  matchId: nextId++,
  startTime: 1_790_000_000 + nextId * 3600,
  heroId: 1,
  isRadiant: true,
  win: true,
  duration: 35 * 60,
  role: "core",
  laneRole: null,
  partySize: 1,
  averageRank: 52,
  kills: 8,
  deaths: 4,
  assists: 10,
  gpm: 500,
  xpm: 600,
  lastHits: 200,
  denies: 10,
  heroDamage: 20000,
  towerDamage: 2000,
  heroHealing: 0,
  parsed: false,
  pct: { gpm: 0.5, xpm: 0.5, lhPerMin: 0.5, deathsPerMin: 0.5, damagePerMin: 0.5 },
  replay: null,
  ...over,
});

const names = new Map([
  [1, "Anti-Mage"],
  [2, "Axe"],
]);

describe("buildTrends", () => {
  it("counts results and splits by duration and party", () => {
    const list = [
      match({ win: true, duration: 25 * 60 }),
      match({ win: false, duration: 45 * 60, partySize: 2 }),
      match({ win: true, duration: 35 * 60 }),
    ];
    const t = buildTrends(list, names);
    expect(t.games).toBe(3);
    expect(t.wins).toBe(2);
    expect(t.byDuration.map((b) => [b.key, b.games])).toEqual([
      ["short", 1],
      ["mid", 1],
      ["long", 1],
    ]);
    expect(t.byParty.map((b) => [b.key, b.games, b.wins])).toEqual([
      ["solo", 2, 2],
      ["party", 1, 0],
    ]);
  });

  it("builds a rolling average from oldest to newest", () => {
    const list = [0.9, 0.7, 0.5, 0.3, 0.1].map((v) => match({ pct: { gpm: v } })); // terbaru dulu
    const s = buildTrends(list, names).series.gpm;
    expect(s.map((p) => p.value)).toEqual([0.1, 0.3, 0.5, 0.7, 0.9]);
    expect(s[1].rolling).toBeCloseTo(0.2);
    expect(s[4].rolling).toBeCloseTo(0.5);
  });

  it("spots more deaths in losses", () => {
    const list = [
      ...Array.from({ length: 5 }, () => match({ win: true, deaths: 3 })),
      ...Array.from({ length: 5 }, () => match({ win: false, deaths: 9 })),
    ];
    const texts = buildTrends(list, names).patterns.map((p) => p.text);
    expect(texts[0]).toMatch(/^In games you lose you die 9\.0 times on average, against 3\.0/);
  });

  it("spots a hero that keeps losing", () => {
    const list = Array.from({ length: 6 }, (_, i) => match({ heroId: 2, win: i === 0 }));
    const texts = buildTrends(list, names).patterns.map((p) => p.text);
    expect(texts).toContain("You've lost 5 of your last 6 games on Axe.");
  });

  it("stays quiet with too few games", () => {
    const list = [match({ win: false, deaths: 12 }), match({ win: true, deaths: 1 })];
    expect(buildTrends(list, names).patterns).toEqual([]);
  });
});

describe("buildHeroPool", () => {
  const positions = [
    { heroId: 1, position: 1, matchCount: 900, winCount: 450 },
    { heroId: 1, position: 2, matchCount: 100, winCount: 50 },
    { heroId: 2, position: 3, matchCount: 1000, winCount: 500 },
    { heroId: 3, position: 5, matchCount: 1000, winCount: 500 },
    { heroId: 4, position: 4, matchCount: 1000, winCount: 500 },
  ];

  const pool = buildHeroPool(
    [
      { hero_id: 1, games: 30, win: 20 }, // sering, di atas meta
      { hero_id: 2, games: 20, win: 6 }, // sering, di bawah meta
      { hero_id: 3, games: 5, win: 4 }, // jarang, di atas
      { hero_id: 4, games: 4, win: 1 }, // jarang, di bawah
      { hero_id: 5, games: 2, win: 2 }, // terlalu sedikit
    ],
    positions,
  );

  it("sorts heroes into four groups", () => {
    const q = Object.fromEntries(pool.heroes.map((h) => [h.heroId, h.quadrant]));
    expect(q).toEqual({ 1: "core", 2: "trap", 3: "potential", 4: "avoid" });
  });

  it("smooths small samples toward the meta win rate", () => {
    const h3 = pool.heroes.find((h) => h.heroId === 3)!;
    expect(h3.winRate).toBeCloseTo((4 + 10 * 0.5) / 15);
  });

  it("suggests heroes per position", () => {
    expect(pool.focus[1].map((h) => h.heroId)).toEqual([1]);
    expect(pool.focus[5].map((h) => h.heroId)).toEqual([3]);
    expect(pool.focus[3]).toEqual([]);
  });
});

describe("goals", () => {
  const created = new Date((1_790_000_000 + 100) * 1000);
  const goal = (over: Partial<GoalInput> = {}): GoalInput => ({
    metric: "deaths",
    direction: "atMost",
    target: 5,
    games: 2,
    heroId: null,
    createdAt: created,
    ...over,
  });

  it("describes the goal in words", () => {
    expect(goalText(goal())).toBe("Deaths at most 5 in 2 games");
    expect(goalText(goal({ metric: "lhPerMin", direction: "atLeast", target: 6 }))).toBe(
      "Last hits per minute at least 6/min in 2 games",
    );
    expect(goalText(goal({ metric: "win", games: 3 }))).toBe("Win 3 games");
  });

  it("counts only games after the goal was set", () => {
    const old = match({ startTime: 1_790_000_000, deaths: 1 });
    const p = goalProgress(goal(), [old]);
    expect(p.counted).toBe(0);
  });

  it("finishes after enough games hit the target", () => {
    const t = 1_790_000_000 + 1000;
    const list = [
      match({ startTime: t, deaths: 8 }),
      match({ startTime: t + 10, deaths: 3 }),
      match({ startTime: t + 20, deaths: 5 }),
      match({ startTime: t + 30, deaths: 0 }),
    ];
    const p = goalProgress(goal(), list);
    expect(p.met).toBe(2);
    expect(p.done).toBe(true);
    expect(p.counted).toBe(3); // berhenti setelah target tercapai
    expect(p.results[0].value).toBe(5); // terbaru dulu
  });

  it("filters by hero and waits for replays when needed", () => {
    const t = 1_790_000_000 + 1000;
    const list = [
      match({ startTime: t, heroId: 2, replay: null }),
      match({
        startTime: t + 10,
        heroId: 2,
        replay: {
          lh10: 55,
          dn10: 5,
          obsPlaced: null,
          senPlaced: null,
          obsLifetime: null,
          obsDewarded: null,
          position: 1,
        },
      }),
      match({ startTime: t + 20, heroId: 1 }),
    ];
    const p = goalProgress(
      goal({ metric: "lh10", direction: "atLeast", target: 50, heroId: 2 }),
      list,
    );
    expect(p.met).toBe(1);
    expect(p.waitingForReplay).toBe(1);
    expect(p.done).toBe(false);
  });
});
