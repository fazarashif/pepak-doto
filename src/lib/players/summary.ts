// Ringkasan match pemain untuk profil (tren, target latihan). Fungsi murni.
//
// Sumber utamanya daftar match dari /players/{id}/matches, yang tidak butuh parse replay.
// Persentil dihitung sendiri dari /benchmarks per hero, jadi detail tiap match tidak perlu
// diambil. Data dari replay (LH@10, ward) ditambahkan belakangan lewat `enrichFromMatch`.

import type { Match } from "@/lib/opendota/types";

export const TURBO_GAME_MODE = 23;
/** Match lebih pendek dari ini biasanya remake atau ada yang tidak connect. */
const MIN_DURATION = 10 * 60;

/** Field yang diminta dari /players/{id}/matches (parameter `project`). */
export const MATCH_FIELDS = [
  "hero_id",
  "start_time",
  "duration",
  "game_mode",
  "lobby_type",
  "kills",
  "deaths",
  "assists",
  "gold_per_min",
  "xp_per_min",
  "last_hits",
  "denies",
  "hero_damage",
  "tower_damage",
  "hero_healing",
  "lane_role",
  "is_roaming",
  "version",
  "party_size",
  "average_rank",
  "leaver_status",
] as const;

export interface RawPlayerMatch {
  match_id: number;
  player_slot: number;
  radiant_win: boolean;
  hero_id: number;
  start_time: number;
  duration: number;
  game_mode: number;
  lobby_type: number;
  kills: number;
  deaths: number;
  assists: number;
  gold_per_min: number;
  xp_per_min: number;
  last_hits: number;
  denies: number;
  hero_damage: number | null;
  tower_damage: number | null;
  hero_healing: number | null;
  lane_role: number | null;
  is_roaming: boolean | null;
  /** Ada kalau replay sudah di-parse. */
  version: number | null;
  party_size: number | null;
  average_rank: number | null;
  leaver_status: number | null;
}

/** Metrik yang punya persentil. Semua dibuat "makin tinggi makin baik". */
export const PCT_METRICS = ["gpm", "xpm", "lhPerMin", "deathsPerMin", "damagePerMin"] as const;
export type PctMetric = (typeof PCT_METRICS)[number];

/** Nama field di /benchmarks untuk tiap metrik. */
const BENCHMARK_FIELD: Record<PctMetric, string> = {
  gpm: "gold_per_min",
  xpm: "xp_per_min",
  lhPerMin: "last_hits_per_min",
  deathsPerMin: "deaths_per_min",
  damagePerMin: "hero_damage_per_min",
};

/** Di /benchmarks, persentil kematian naik seiring jumlah kematian, jadi dibalik. */
const LOWER_IS_BETTER = new Set<PctMetric>(["deathsPerMin"]);

export type BenchmarkPoints = { percentile: number; value: number }[];
export type HeroBenchmarks = Record<string, BenchmarkPoints>;

export type Role = "core" | "support" | "unknown";

export interface ReplayStats {
  lh10: number | null;
  dn10: number | null;
  obsPlaced: number | null;
  senPlaced: number | null;
  /** Umur rata-rata observer (detik). */
  obsLifetime: number | null;
  /** Observer yang dihancurkan musuh. */
  obsDewarded: number | null;
  /** Posisi 1..5 menurut perkiraan OpenDota. */
  position: number | null;
}

export interface MatchSummary {
  matchId: number;
  startTime: number;
  heroId: number;
  isRadiant: boolean;
  win: boolean;
  duration: number;
  role: Role;
  /** 1 safe, 2 mid, 3 off, 4 jungle. Hanya ada kalau sudah di-parse. */
  laneRole: number | null;
  partySize: number | null;
  averageRank: number | null;
  kills: number;
  deaths: number;
  assists: number;
  gpm: number;
  xpm: number;
  lastHits: number;
  denies: number;
  heroDamage: number | null;
  towerDamage: number | null;
  heroHealing: number | null;
  parsed: boolean;
  /** Persentil 0..1 dibanding pemain lain di hero yang sama (makin tinggi makin baik). */
  pct: Partial<Record<PctMetric, number>>;
  replay: ReplayStats | null;
}

/** Persentil dari titik benchmark (0.1, 0.2, ... 0.99), interpolasi linear. */
export function percentileOf(points: BenchmarkPoints, value: number): number | null {
  if (!points.length || !Number.isFinite(value)) return null;
  const sorted = [...points].sort((a, b) => a.percentile - b.percentile);
  if (value <= sorted[0].value) {
    // Di bawah titik terendah: turun linear ke 0.
    const first = sorted[0];
    return first.value > 0 ? Math.max(0, (value / first.value) * first.percentile) : 0;
  }
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1];
    const b = sorted[i];
    if (value <= b.value) {
      const t = b.value === a.value ? 1 : (value - a.value) / (b.value - a.value);
      return a.percentile + t * (b.percentile - a.percentile);
    }
  }
  return 1;
}

function roleFor(m: RawPlayerMatch): Role {
  if (m.lane_role === 2) return "core";
  if (m.is_roaming) return "support";
  const lhPerMin = m.duration > 0 ? m.last_hits / (m.duration / 60) : 0;
  if (lhPerMin < 2) return "support";
  if (lhPerMin >= 4) return "core";
  return "unknown";
}

/** Match yang tidak dipakai: Turbo, remake, dan match yang ditinggal (abandon). */
export function isCountable(m: RawPlayerMatch) {
  return (
    m.game_mode !== TURBO_GAME_MODE && m.duration >= MIN_DURATION && (m.leaver_status ?? 0) <= 1
  );
}

export function summarizeMatch(m: RawPlayerMatch, benchmarks: HeroBenchmarks | null): MatchSummary {
  const minutes = m.duration / 60;
  const isRadiant = m.player_slot < 128;
  const raw: Record<PctMetric, number> = {
    gpm: m.gold_per_min,
    xpm: m.xp_per_min,
    lhPerMin: m.last_hits / minutes,
    deathsPerMin: m.deaths / minutes,
    damagePerMin: (m.hero_damage ?? NaN) / minutes,
  };
  const pct: Partial<Record<PctMetric, number>> = {};
  if (benchmarks) {
    for (const metric of PCT_METRICS) {
      const p = percentileOf(benchmarks[BENCHMARK_FIELD[metric]] ?? [], raw[metric]);
      if (p !== null) pct[metric] = LOWER_IS_BETTER.has(metric) ? 1 - p : p;
    }
  }
  return {
    matchId: m.match_id,
    startTime: m.start_time,
    heroId: m.hero_id,
    isRadiant,
    win: isRadiant === m.radiant_win,
    duration: m.duration,
    role: roleFor(m),
    laneRole: m.lane_role ?? null,
    partySize: m.party_size ?? null,
    averageRank: m.average_rank ?? null,
    kills: m.kills,
    deaths: m.deaths,
    assists: m.assists,
    gpm: m.gold_per_min,
    xpm: m.xp_per_min,
    lastHits: m.last_hits,
    denies: m.denies ?? 0,
    heroDamage: m.hero_damage ?? null,
    towerDamage: m.tower_damage ?? null,
    heroHealing: m.hero_healing ?? null,
    parsed: Boolean(m.version),
    pct,
    replay: null,
  };
}

/**
 * Ambil statistik replay seorang pemain dari detail match yang sudah di-parse.
 * `heroKey` adalah nama internal hero pemain (mis. "npc_dota_hero_rubick").
 */
export function replayStatsFrom(
  match: Match,
  accountId: number,
  heroKey: string,
): ReplayStats | null {
  const p = match.players.find((x) => x.account_id === accountId) as
    | (Match["players"][number] & {
        obs_log?: { time: number; ehandle?: number }[] | null;
        obs_left_log?: { time: number; ehandle?: number; attackername?: string }[] | null;
      })
    | undefined;
  if (!p || !match.od_data?.has_parsed) return null;

  const placed = new Map((p.obs_log ?? []).map((w) => [w.ehandle, w.time]));
  const lifetimes: number[] = [];
  let dewarded = 0;
  const own = p.obs_left_log ?? [];
  for (const left of own) {
    const start = placed.get(left.ehandle);
    if (start === undefined) continue;
    lifetimes.push(left.time - start);
    // Ward yang habis waktunya dicatat dengan hero pemain sendiri sebagai "attacker".
    if (left.attackername && left.attackername !== heroKey) dewarded++;
  }
  const avg = lifetimes.length ? lifetimes.reduce((s, t) => s + t, 0) / lifetimes.length : null;

  return {
    lh10: p.lh_t?.[10] ?? null,
    dn10: p.dn_t?.[10] ?? null,
    obsPlaced: p.obs_placed ?? null,
    senPlaced: p.sen_placed ?? null,
    obsLifetime: avg === null ? null : Math.round(avg),
    obsDewarded: lifetimes.length ? dewarded : null,
    position: p.position_est ?? null,
  };
}
