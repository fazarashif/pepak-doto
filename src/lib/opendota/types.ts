// Tipe respons OpenDota yang dipakai aplikasi (hanya field yang dibutuhkan).
// Referensi: https://docs.opendota.com/

export type BracketKey = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export interface HeroStat {
  id: number;
  name: string; // "npc_dota_hero_antimage"
  localized_name: string;
  primary_attr: "str" | "agi" | "int" | "all";
  attack_type: "Melee" | "Ranged";
  roles: string[];
  img: string;
  icon: string;
  pub_pick: number;
  pub_win: number;
  // `${bracket}_pick` / `${bracket}_win` untuk bracket 1..8
  [key: `${number}_pick` | `${number}_win`]: number;
}

/** Rekor hero X melawan `hero_id` (wins = kemenangan hero X). */
export interface Matchup {
  hero_id: number;
  games_played: number;
  wins: number;
}

export interface LaneRoleRow {
  hero_id: number;
  lane_role: 1 | 2 | 3 | 4; // 1 safe, 2 mid, 3 off, 4 jungle
  time: number;
  games: string;
  wins: string;
}

export interface PlayerProfile {
  profile?: {
    account_id: number;
    personaname?: string | null;
    avatarfull?: string | null;
    profileurl?: string | null;
  } | null;
  rank_tier?: number | null;
  leaderboard_rank?: number | null;
}

export interface PlayerHero {
  hero_id: number;
  games: number;
  win: number;
}

export interface RecentMatch {
  match_id: number;
  player_slot: number;
  radiant_win: boolean;
  hero_id: number;
  start_time: number;
  duration: number;
  game_mode: number;
  kills: number;
  deaths: number;
  assists: number;
}

export interface ItemTimingRow {
  hero_id: number;
  item: string;
  time: number; // batas atas bucket (detik)
  games: string;
  wins: string;
}

export interface ItemConstant {
  id: number;
  dname?: string;
  img?: string;
  cost?: number | null;
  qual?: string;
  components?: string[] | null;
}

export interface Benchmark {
  raw: number;
  /** Persentil dibanding semua pemain hero ini (0..1). */
  pct: number;
  /** Persentil dibanding pemain hero ini di bracket rank yang sama, kalau tersedia. */
  pct_bracket?: number;
}

export interface MatchPlayer {
  player_slot: number;
  account_id?: number | null;
  personaname?: string | null;
  hero_id: number;
  isRadiant: boolean;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  last_hits: number;
  denies: number;
  gold_per_min: number;
  xp_per_min: number;
  net_worth?: number;
  hero_damage: number;
  tower_damage: number;
  hero_healing: number;
  level: number;
  rank_tier?: number | null;
  item_0: number;
  item_1: number;
  item_2: number;
  item_3: number;
  item_4: number;
  item_5: number;
  item_neutral?: number;
  benchmarks?: Record<string, Benchmark>;
  // Field di bawah hanya ada kalau replay sudah di-parse
  lane?: number | null; // 1 bawah, 2 mid, 3 atas, 4/5 jungle
  lane_role?: number | null;
  position_est?: number | null;
  leaver_status?: number | null;
  lane_efficiency_pct?: number | null;
  lh_t?: number[] | null;
  dn_t?: number[] | null;
  gold_t?: number[] | null;
  teamfight_participation?: number | null;
  obs_placed?: number | null;
  sen_placed?: number | null;
  observer_kills?: number | null;
  sentry_kills?: number | null;
  camps_stacked?: number | null;
  deaths_log?: { time: number; key: string; time_dead?: number; gold_lost?: number }[] | null;
  killed_by?: Record<string, number> | null;
  first_purchase_time?: Record<string, number> | null;
}

export interface Match {
  match_id: number;
  duration: number;
  radiant_win: boolean;
  game_mode: number;
  lobby_type: number;
  start_time: number;
  patch?: number;
  version?: number | null;
  od_data?: { has_parsed?: boolean } | null;
  players: MatchPlayer[];
}

export interface DurationRow {
  duration_bin: number; // detik
  games_played: number;
  wins: number;
}

export interface AbilityConstant {
  dname?: string;
  desc?: string;
  behavior?: string | string[];
  bkbpierce?: string;
  dispellable?: string;
}

/** { x: { y: jumlah } } dengan koordinat grid 64..192. */
export interface WardMap {
  obs: Record<string, Record<string, number>>;
  sen: Record<string, Record<string, number>>;
}
