// Ringkasan tren di profil pemain, ditutup satu saran target latihan.

import { GOAL_METRICS, isGoalMetric, type Direction, type GoalMetric } from "@/lib/players/goals";
import type { MatchSummary } from "@/lib/players/summary";
import { METRIC_LABEL, type Trends } from "@/lib/players/trends";
import { nameError, str, STYLE, type Vocabulary } from "./common";

export const TREND_SUMMARY_VERSION = 1;

export interface SuggestedGoal {
  metric: GoalMetric;
  direction: Direction;
  target: number;
  games: number;
}

export interface TrendSummary {
  summary: string;
  goal: SuggestedGoal | null;
  goalReason: string | null;
}

export const TREND_SUMMARY_SYSTEM = [
  "You are a Dota 2 coach looking at a player's recent matches.",
  STYLE,
  "Explain the one or two things that matter most for winning more, based on the patterns and percentiles, and end with one practice goal.",
  'Shape: {"summary": string (2 to 4 sentences), "goal": {"metric": one of "goal_metrics" keys, "direction": "atLeast" or "atMost", "target": number, "games": whole number from 3 to 10} or null, "goal_reason": string (one sentence) or null}.',
  "Pick a target the player can reach but that is better than their current average.",
].join(" ");

export function trendFacts(
  trends: Trends,
  matches: MatchSummary[],
  ctx: { replayMetrics: boolean },
) {
  const supportGames = matches.filter((m) => m.role === "support").length;
  const avg = (f: (m: MatchSummary) => number) =>
    matches.length
      ? Math.round((matches.reduce((s, m) => s + f(m), 0) / matches.length) * 10) / 10
      : 0;
  const heroes = trends.byHero.filter((h) => h.games >= 3);
  const metrics = (Object.keys(GOAL_METRICS) as GoalMetric[]).filter(
    (k) => ctx.replayMetrics || !GOAL_METRICS[k].needsReplay,
  );
  const facts = {
    games: trends.games,
    win_rate: trends.games ? Math.round((trends.wins / trends.games) * 100) : 0,
    main_role: supportGames / Math.max(1, matches.length) >= 0.6 ? "support" : "core",
    averages: {
      kills: avg((m) => m.kills),
      deaths: avg((m) => m.deaths),
      assists: avg((m) => m.assists),
      gpm: avg((m) => m.gpm),
      last_hits_per_min: avg((m) => m.lastHits / (m.duration / 60)),
    },
    percentiles_vs_same_heroes: Object.fromEntries(
      Object.entries(trends.avgPct).map(([k, v]) => [
        METRIC_LABEL[k as keyof typeof METRIC_LABEL],
        Math.round((v ?? 0) * 100),
      ]),
    ),
    patterns: trends.patterns.map((p) => p.text),
    heroes: heroes.map((h) => ({ hero: h.label, won: h.wins, lost: h.games - h.wins })),
    by_game_length: trends.byDuration.map((b) => ({
      length: b.label,
      games: b.games,
      won: b.wins,
    })),
    goal_metrics: Object.fromEntries(metrics.map((k) => [k, GOAL_METRICS[k].label])),
  };
  return { facts, allowed: heroes.map((h) => h.label), metrics };
}

export function parseTrendSummary(
  json: unknown,
  allowed: string[],
  metrics: GoalMetric[],
  vocab: Vocabulary,
): { value: TrendSummary } | { error: string } {
  const o = json as Record<string, unknown>;
  const summary = str(o?.summary, 900);
  if (!summary) return { error: "Missing summary" };
  let goal: SuggestedGoal | null = null;
  const g = o.goal as Record<string, unknown> | null | undefined;
  if (g) {
    const metric = typeof g.metric === "string" ? g.metric : "";
    const target = Number(g.target);
    const games = Number(g.games);
    if (
      !isGoalMetric(metric) ||
      !metrics.includes(metric) ||
      (g.direction !== "atLeast" && g.direction !== "atMost") ||
      !Number.isFinite(target) ||
      target < 0 ||
      !Number.isInteger(games) ||
      games < 1 ||
      games > 20
    ) {
      return { error: "Invalid goal" };
    }
    goal = { metric, direction: g.direction, target: Math.round(target * 10) / 10, games };
  }
  const value = { summary, goal, goalReason: goal ? str(o.goal_reason, 300) : null };
  const bad = nameError(value, allowed, vocab);
  return bad ? { error: bad } : { value };
}

/** Cadangan tanpa LLM: dua pola teratas, dan target kematian kalau itu polanya. */
export function trendTemplate(trends: Trends, matches: MatchSummary[]): TrendSummary {
  const top = trends.patterns.slice(0, 2).map((p) => p.text);
  const wins = matches.filter((m) => m.win);
  const deathsPattern = trends.patterns.some((p) => p.text.startsWith("In games you lose you die"));
  const winDeaths = wins.length
    ? Math.round(wins.reduce((s, m) => s + m.deaths, 0) / wins.length)
    : null;
  return {
    summary: top.length
      ? top.join(" ")
      : "No strong pattern shows up in these games yet. Play a few more and check again.",
    goal:
      deathsPattern && winDeaths !== null
        ? { metric: "deaths", direction: "atMost", target: Math.max(2, winDeaths), games: 5 }
        : null,
    goalReason: deathsPattern ? "Your wins come with far fewer deaths." : null,
  };
}
