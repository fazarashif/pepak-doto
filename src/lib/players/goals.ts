// Target latihan: katalog metrik dan penghitungan progres. Fungsi murni.

import { ordinal } from "@/lib/dota";
import type { MatchSummary } from "./summary";

export type Direction = "atLeast" | "atMost";

export interface MetricDef {
  label: string;
  /** Satuan singkat untuk ditampilkan setelah angka. */
  unit: string;
  /** Arah yang paling masuk akal, dipakai sebagai default di form. */
  direction: Direction;
  /** Contoh angka target untuk form. */
  example: number;
  /** Butuh replay yang sudah di-parse. */
  needsReplay: boolean;
  step: number;
  value: (m: MatchSummary) => number | null;
}

const perMin = (x: number, m: MatchSummary) => x / (m.duration / 60);
const pct = (v: number | undefined) => (v === undefined ? null : Math.round(v * 100));

export const GOAL_METRICS = {
  deaths: {
    label: "Deaths",
    unit: "",
    direction: "atMost",
    example: 5,
    needsReplay: false,
    step: 1,
    value: (m) => m.deaths,
  },
  kills: {
    label: "Kills",
    unit: "",
    direction: "atLeast",
    example: 8,
    needsReplay: false,
    step: 1,
    value: (m) => m.kills,
  },
  assists: {
    label: "Assists",
    unit: "",
    direction: "atLeast",
    example: 15,
    needsReplay: false,
    step: 1,
    value: (m) => m.assists,
  },
  kda: {
    label: "KDA ratio",
    unit: "",
    direction: "atLeast",
    example: 3,
    needsReplay: false,
    step: 0.1,
    value: (m) => (m.kills + m.assists) / Math.max(1, m.deaths),
  },
  gpm: {
    label: "GPM",
    unit: "",
    direction: "atLeast",
    example: 500,
    needsReplay: false,
    step: 10,
    value: (m) => m.gpm,
  },
  xpm: {
    label: "XPM",
    unit: "",
    direction: "atLeast",
    example: 600,
    needsReplay: false,
    step: 10,
    value: (m) => m.xpm,
  },
  lhPerMin: {
    label: "Last hits per minute",
    unit: "/min",
    direction: "atLeast",
    example: 6,
    needsReplay: false,
    step: 0.1,
    value: (m) => perMin(m.lastHits, m),
  },
  damagePerMin: {
    label: "Hero damage per minute",
    unit: "/min",
    direction: "atLeast",
    example: 600,
    needsReplay: false,
    step: 10,
    value: (m) => (m.heroDamage === null ? null : perMin(m.heroDamage, m)),
  },
  win: {
    label: "Wins",
    unit: "",
    direction: "atLeast",
    example: 1,
    needsReplay: false,
    step: 1,
    value: (m) => (m.win ? 1 : 0),
  },
  pctGpm: {
    label: "GPM percentile",
    unit: "th",
    direction: "atLeast",
    example: 60,
    needsReplay: false,
    step: 5,
    value: (m) => pct(m.pct.gpm),
  },
  pctLastHits: {
    label: "Last hit percentile",
    unit: "th",
    direction: "atLeast",
    example: 60,
    needsReplay: false,
    step: 5,
    value: (m) => pct(m.pct.lhPerMin),
  },
  pctSurvival: {
    label: "Survival percentile (fewer deaths is higher)",
    unit: "th",
    direction: "atLeast",
    example: 60,
    needsReplay: false,
    step: 5,
    value: (m) => pct(m.pct.deathsPerMin),
  },
  lh10: {
    label: "Last hits at 10 minutes",
    unit: "",
    direction: "atLeast",
    example: 50,
    needsReplay: true,
    step: 1,
    value: (m) => m.replay?.lh10 ?? null,
  },
  dn10: {
    label: "Denies at 10 minutes",
    unit: "",
    direction: "atLeast",
    example: 8,
    needsReplay: true,
    step: 1,
    value: (m) => m.replay?.dn10 ?? null,
  },
  obsPlaced: {
    label: "Observer wards placed",
    unit: "",
    direction: "atLeast",
    example: 12,
    needsReplay: true,
    step: 1,
    value: (m) => m.replay?.obsPlaced ?? null,
  },
  senPlaced: {
    label: "Sentry wards placed",
    unit: "",
    direction: "atLeast",
    example: 10,
    needsReplay: true,
    step: 1,
    value: (m) => m.replay?.senPlaced ?? null,
  },
} satisfies Record<string, MetricDef>;

export type GoalMetric = keyof typeof GOAL_METRICS;

export function isGoalMetric(v: string): v is GoalMetric {
  return Object.hasOwn(GOAL_METRICS, v);
}

export interface GoalInput {
  metric: GoalMetric;
  direction: Direction;
  target: number;
  games: number;
  heroId: number | null;
  createdAt: Date;
}

export interface GoalResult {
  matchId: number;
  heroId: number;
  startTime: number;
  value: number;
  met: boolean;
}

export interface GoalProgress {
  /** Game yang mencapai target. */
  met: number;
  /** Game yang dihitung (punya data untuk metrik ini). */
  counted: number;
  /** Match baru yang belum bisa dihitung karena replay-nya belum di-parse. */
  waitingForReplay: number;
  done: boolean;
  /** Hasil terbaru dulu. */
  results: GoalResult[];
}

export function goalText(g: Pick<GoalInput, "metric" | "direction" | "target" | "games">) {
  const def: MetricDef = GOAL_METRICS[g.metric];
  if (g.metric === "win") return `Win ${g.games} ${g.games === 1 ? "game" : "games"}`;
  const op = g.direction === "atLeast" ? "at least" : "at most";
  const target = def.unit === "th" ? ordinal(g.target) : `${g.target}${def.unit}`;
  return `${def.label} ${op} ${target} in ${g.games} ${g.games === 1 ? "game" : "games"}`;
}

/**
 * Progres satu target dari match yang dimainkan setelah target dibuat.
 * Target selesai kalau jumlah game yang mencapai angka target sudah sebanyak `games`
 * (tidak harus berturut-turut).
 */
export function goalProgress(goal: GoalInput, matches: MatchSummary[]): GoalProgress {
  const def: MetricDef = GOAL_METRICS[goal.metric];
  const since = goal.createdAt.getTime() / 1000;
  const relevant = matches
    .filter((m) => m.startTime >= since && (goal.heroId === null || m.heroId === goal.heroId))
    .sort((a, b) => a.startTime - b.startTime);

  const results: GoalResult[] = [];
  let met = 0;
  let waiting = 0;
  for (const m of relevant) {
    if (met >= goal.games) break;
    const value = def.value(m);
    if (value === null) {
      if (def.needsReplay) waiting++;
      continue;
    }
    const ok = goal.direction === "atLeast" ? value >= goal.target : value <= goal.target;
    if (ok) met++;
    results.push({ matchId: m.matchId, heroId: m.heroId, startTime: m.startTime, value, met: ok });
  }

  return {
    met,
    counted: results.length,
    waitingForReplay: waiting,
    done: met >= goal.games,
    results: results.reverse(),
  };
}
