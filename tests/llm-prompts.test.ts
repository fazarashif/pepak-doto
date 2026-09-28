import { describe, expect, it } from "vitest";
import type { MatchReport } from "@/lib/match/analyze";
import { parseHeroTips } from "@/lib/llm/prompts/hero-tips";
import {
  matchNotesFacts,
  matchNotesTemplate,
  parseMatchNotes,
} from "@/lib/llm/prompts/match-notes";
import { parseTrendSummary, trendTemplate } from "@/lib/llm/prompts/trend-summary";
import type { MatchSummary } from "@/lib/players/summary";
import type { Trends } from "@/lib/players/trends";

const vocab = {
  names: ["Rubick", "Slark", "Phantom Assassin", "Force Staff", "Blade Mail", "Axe"],
};

const report = {
  matchId: 1,
  duration: 46 * 60,
  startTime: 0,
  radiantWin: false,
  parsed: true,
  player: {
    slot: 3,
    heroId: 86,
    name: "Someone",
    isRadiant: true,
    win: false,
    kills: 3,
    deaths: 14,
    assists: 25,
    lastHits: 40,
    denies: 2,
    gpm: 280,
    xpm: 400,
    netWorth: null,
    heroDamage: 15000,
    level: 22,
    rankTier: 45,
    role: "support",
    laneRole: 3,
  },
  items: [{ key: "force_staff", name: "Force Staff", img: "" }],
  grades: [
    {
      key: "survival",
      label: "Survival",
      letter: "D",
      percentile: 0.08,
      detail: "",
      relevant: true,
    },
    {
      key: "farming",
      label: "Farming",
      letter: "D",
      percentile: 0.1,
      detail: "",
      relevant: false,
    },
  ],
  laning: null,
  deaths: {
    total: 14,
    byPhase: [{ label: "Mid game", count: 8 }],
    topKillers: [{ heroId: 93, count: 5 }],
    timeDead: 450,
    goldLost: 3000,
  },
  itemTimings: [],
  vision: null,
  strengths: ["Your fight participation was better than most Rubick players."],
  improvements: [
    {
      title: "Die less in the mid game",
      detail: "8 deaths between 12 and 30.",
      tip: "Move with a teammate.",
    },
  ],
  notes: [],
} as unknown as MatchReport;

const heroNames = new Map([
  [86, "Rubick"],
  [93, "Slark"],
]);

describe("match notes", () => {
  const { facts, allowed } = matchNotesFacts(report, {
    heroName: "Rubick",
    heroNames,
    rankLabel: "Archon 5",
  });

  it("sends only facts, without the player's name or match id", () => {
    const text = JSON.stringify(facts);
    expect(text).not.toContain("Someone");
    expect(text).not.toContain('"matchId"');
    expect(facts.deaths?.killed_most_by).toEqual([{ hero: "Slark", kills: 5 }]);
    // Aspek yang kurang penting untuk support tidak dikirim.
    expect(facts.grades.map((g) => g.area)).toEqual(["Survival"]);
    expect(allowed).toEqual(["Rubick", "Slark", "Force Staff"]);
  });

  const good = {
    summary: "You died 14 times, 8 of them in the mid game.",
    focus: [
      {
        title: "Stop walking alone",
        why: "Slark killed you 5 times.",
        drill: "Rotate with a teammate.",
      },
    ],
    keep_doing: "Your fight participation was good.",
  };

  it("accepts a well-formed answer", () => {
    const res = parseMatchNotes(good, allowed, vocab);
    expect("value" in res && res.value.focus[0].title).toBe("Stop walking alone");
  });

  it("rejects items that aren't in the facts", () => {
    const bad = { ...good, focus: [{ ...good.focus[0], drill: "Buy Blade Mail." }] };
    const res = parseMatchNotes(bad, allowed, vocab);
    expect("error" in res && res.error).toMatch(/Blade Mail/);
  });

  it("rejects the wrong shape", () => {
    expect("error" in parseMatchNotes({ summary: "x", focus: [] }, allowed, vocab)).toBe(true);
    expect("error" in parseMatchNotes({ focus: good.focus }, allowed, vocab)).toBe(true);
  });

  it("has a plain fallback from the app's own priorities", () => {
    const t = matchNotesTemplate(report);
    expect(t.summary).toBe(
      "This one was a loss. The biggest thing to work on: die less in the mid game.",
    );
    expect(t.focus[0]).toEqual({
      title: "Die less in the mid game",
      why: "8 deaths between 12 and 30.",
      drill: "Move with a teammate.",
    });
  });
});

describe("trend summary", () => {
  const good = {
    summary: "Deaths decide your games.",
    goal: { metric: "deaths", direction: "atMost", target: 7, games: 5 },
    goal_reason: "Your wins come with fewer deaths.",
  };

  it("accepts a goal from the allowed metrics", () => {
    const res = parseTrendSummary(good, [], ["deaths", "kda"], vocab);
    expect("value" in res && res.value.goal).toEqual({
      metric: "deaths",
      direction: "atMost",
      target: 7,
      games: 5,
    });
  });

  it("rejects metrics that weren't offered", () => {
    const res = parseTrendSummary(
      { ...good, goal: { ...good.goal, metric: "lh10" } },
      [],
      ["deaths"],
      vocab,
    );
    expect("error" in res).toBe(true);
  });

  it("allows no goal", () => {
    const res = parseTrendSummary({ summary: "Fine.", goal: null }, [], ["deaths"], vocab);
    expect("value" in res && res.value.goal).toBeNull();
  });

  it("suggests a deaths goal in the fallback when deaths are the pattern", () => {
    const trends = {
      patterns: [
        {
          text: "In games you lose you die 10.5 times on average, against 6.1 in wins.",
          tone: "bad",
          strength: 2,
        },
      ],
    } as unknown as Trends;
    const matches = [
      { win: true, deaths: 6 },
      { win: true, deaths: 7 },
      { win: false, deaths: 11 },
    ] as MatchSummary[];
    expect(trendTemplate(trends, matches).goal).toEqual({
      metric: "deaths",
      direction: "atMost",
      target: 7,
      games: 5,
    });
  });
});

describe("hero tips", () => {
  it("needs 3 to 5 tips that only use listed names", () => {
    const allowed = ["Phantom Assassin", "Axe"];
    const ok = parseHeroTips(
      { tips: ["Pick Axe.", "Watch her crits.", "Group up early."] },
      allowed,
      vocab,
    );
    expect("value" in ok).toBe(true);
    expect("error" in parseHeroTips({ tips: ["Only one"] }, allowed, vocab)).toBe(true);
    const bad = parseHeroTips({ tips: ["Pick Slark.", "b", "c"] }, allowed, vocab);
    expect("error" in bad && bad.error).toMatch(/Slark/);
  });
});
