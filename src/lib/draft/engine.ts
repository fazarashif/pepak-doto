// Mesin rekomendasi draft. Fungsi murni: data masuk, rekomendasi keluar, tanpa fetch.
// Semua angka dalam poin persen (pp): +2 berarti sekitar 2% lebih sering menang.

import type { HeroInfo } from "@/lib/dota";

/** Hubungan hero A dengan hero B dari sudut pandang A (data STRATZ). */
export interface PairStat {
  /** Poin persen. Untuk `vs`: positif berarti A unggul atas B. Untuk `with`: positif berarti cocok. */
  synergy: number;
  matchCount: number;
}

export interface HeroMatchupTable {
  with: Map<number, PairStat>;
  vs: Map<number, PairStat>;
}

export interface PositionStat {
  matches: number;
  wins: number;
}

export interface DraftData {
  heroes: HeroInfo[];
  /** Per hero: statistik untuk posisi 1..5 (index 0..4). Kosong kalau data posisi tidak tersedia. */
  positions: Map<number, PositionStat[]>;
  /** Tabel matchup untuk hero yang sudah dipilih (kawan dan lawan). */
  matchups: Map<number, HeroMatchupTable>;
  /** Hero pool user yang login. */
  pool?: Map<number, { games: number; wins: number }>;
}

export interface DraftInput {
  allies: number[];
  enemies: number[];
  bans: number[];
  /** 0 = semua posisi, 1..5 */
  position: number;
  poolOnly: boolean;
  /** Nama bracket untuk teks alasan, mis. "Legend and Ancient" */
  bracketLabel: string;
}

export type ReasonKind = "counter" | "weak" | "synergy" | "meta" | "pool" | "team" | "threat";

export interface Reason {
  kind: ReasonKind;
  text: string;
}

export interface PickSuggestion {
  heroId: number;
  score: number;
  counter: number;
  synergy: number;
  meta: number;
  reasons: Reason[];
}

export interface BanSuggestion {
  heroId: number;
  score: number;
  reasons: Reason[];
}

export interface DraftResult {
  picks: PickSuggestion[];
  bans: BanSuggestion[];
  warnings: string[];
}

export const WEIGHTS = { counter: 1.0, synergy: 0.6, meta: 0.7, banThreat: 1.0, banMeta: 0.7 };
/** Semakin kecil sampel, semakin nilai ditarik ke nol. */
const PAIR_SHRINK = 300;
const META_SHRINK = 500;
const POOL_SHRINK = 10;
export const MIN_POSITION_SHARE = 0.1;
export const MIN_POOL_GAMES = 5;
const PICK_LIMIT = 12;
const BAN_LIMIT = 5;

const POSITION_NAMES = ["", "carry", "mid", "offlane", "soft support", "hard support"];

function shrinkPair(stat: PairStat) {
  return stat.synergy * (stat.matchCount / (stat.matchCount + PAIR_SHRINK));
}

function smoothedWinRate(wins: number, games: number, k: number) {
  return (wins + k * 0.5) / (games + k);
}

function fmt(pp: number) {
  const v = Math.abs(pp) < 0.05 ? 0 : pp;
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function mean(values: number[]) {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function hasRole(hero: HeroInfo | undefined, role: string) {
  return Boolean(hero?.roles.includes(role));
}

/** Winrate meta (pp di atas 50%) untuk posisi tertentu, atau semua posisi kalau 0. */
export function metaScore(stats: PositionStat[] | undefined, position: number) {
  if (!stats?.length) return { pp: 0, matches: 0, winRate: null as number | null };
  const rows = position > 0 ? [stats[position - 1]].filter(Boolean) : stats;
  const matches = rows.reduce((s, r) => s + r.matches, 0);
  const wins = rows.reduce((s, r) => s + r.wins, 0);
  const wr = smoothedWinRate(wins, matches, META_SHRINK);
  return { pp: (wr - 0.5) * 100, matches, winRate: matches ? wins / matches : null };
}

/** Porsi game hero di posisi tertentu. Null kalau datanya tidak ada. */
export function positionShare(stats: PositionStat[] | undefined, position: number) {
  if (!stats?.length || position === 0) return null;
  const total = stats.reduce((s, r) => s + r.matches, 0);
  return total ? (stats[position - 1]?.matches ?? 0) / total : null;
}

export function recommend(input: DraftInput, data: DraftData): DraftResult {
  const byId = new Map(data.heroes.map((h) => [h.id, h]));
  const taken = new Set([...input.allies, ...input.enemies, ...input.bans]);
  const allies = input.allies.map((id) => byId.get(id)).filter(Boolean) as HeroInfo[];
  const enemies = input.enemies.map((id) => byId.get(id)).filter(Boolean) as HeroInfo[];

  const teamLacks = (role: string) => allies.length >= 2 && !allies.some((h) => hasRole(h, role));
  const slipperyEnemies = enemies.filter((h) => hasRole(h, "Escape"));

  const picks: PickSuggestion[] = [];

  for (const hero of data.heroes) {
    if (taken.has(hero.id)) continue;
    const stats = data.positions.get(hero.id);

    const share = positionShare(stats, input.position);
    if (share !== null && share < MIN_POSITION_SHARE) continue;

    const poolEntry = data.pool?.get(hero.id);
    if (input.poolOnly && (!poolEntry || poolEntry.games < MIN_POOL_GAMES)) continue;

    const reasons: Reason[] = [];

    // Keunggulan melawan tiap musuh, dari tabel `vs` milik musuh itu (tandanya dibalik).
    const vsEnemies = enemies
      .map((e) => {
        const stat = data.matchups.get(e.id)?.vs.get(hero.id);
        return stat ? { hero: e, adv: -shrinkPair(stat) } : null;
      })
      .filter(Boolean) as { hero: HeroInfo; adv: number }[];
    const counter = mean(vsEnemies.map((v) => v.adv));
    const sortedVs = [...vsEnemies].sort((a, b) => b.adv - a.adv);
    for (const v of sortedVs.slice(0, 2)) {
      if (v.adv >= 1)
        reasons.push({ kind: "counter", text: `Strong against ${v.hero.name} (${fmt(v.adv)})` });
    }
    const worst = sortedVs.at(-1);
    if (worst && worst.adv <= -1.5) {
      reasons.push({
        kind: "weak",
        text: `Struggles against ${worst.hero.name} (${fmt(worst.adv)})`,
      });
    }

    const withAllies = allies
      .map((a) => {
        const stat = data.matchups.get(a.id)?.with.get(hero.id);
        return stat ? { hero: a, syn: shrinkPair(stat) } : null;
      })
      .filter(Boolean) as { hero: HeroInfo; syn: number }[];
    const synergy = mean(withAllies.map((w) => w.syn));
    const bestAlly = [...withAllies].sort((a, b) => b.syn - a.syn)[0];
    if (bestAlly && bestAlly.syn >= 1) {
      reasons.push({
        kind: "synergy",
        text: `Pairs well with ${bestAlly.hero.name} (${fmt(bestAlly.syn)})`,
      });
    }

    const meta = metaScore(stats, input.position);
    if (meta.winRate !== null && meta.matches >= 200) {
      const where = input.position ? ` as ${POSITION_NAMES[input.position]}` : "";
      reasons.push({
        kind: "meta",
        text: `${(meta.winRate * 100).toFixed(1)}% win rate${where} in ${input.bracketLabel}`,
      });
    }

    let team = 0;
    if (teamLacks("Disabler") && hasRole(hero, "Disabler")) {
      team += 1;
      reasons.push({ kind: "team", text: "Adds a disable your team is missing" });
    }
    if (teamLacks("Initiator") && hasRole(hero, "Initiator")) {
      team += 1;
      reasons.push({ kind: "team", text: "Can start fights, which your team lacks" });
    }
    if (slipperyEnemies.length >= 2 && hasRole(hero, "Disabler")) {
      team += 0.5;
      reasons.push({ kind: "team", text: "Can pin down their slippery heroes" });
    }

    let pool = 0;
    if (poolEntry && poolEntry.games > 0) {
      const wr = smoothedWinRate(poolEntry.wins, poolEntry.games, POOL_SHRINK);
      pool = 0.5 * (wr - 0.5) * 100 + 2 * Math.min(1, poolEntry.games / 30);
      reasons.push({
        kind: "pool",
        text: `You've played it ${poolEntry.games} times, ${Math.round((poolEntry.wins / poolEntry.games) * 100)}% wins`,
      });
    }

    const score =
      WEIGHTS.counter * counter + WEIGHTS.synergy * synergy + WEIGHTS.meta * meta.pp + team + pool;
    picks.push({ heroId: hero.id, score, counter, synergy, meta: meta.pp, reasons });
  }

  picks.sort((a, b) => b.score - a.score);

  return {
    picks: picks.slice(0, PICK_LIMIT),
    bans: suggestBans(input, data, byId, taken),
    warnings: compositionWarnings(allies, enemies),
  };
}

function suggestBans(
  input: DraftInput,
  data: DraftData,
  byId: Map<number, HeroInfo>,
  taken: Set<number>,
): BanSuggestion[] {
  const allies = input.allies.map((id) => byId.get(id)).filter(Boolean) as HeroInfo[];
  const totalMatches = [...data.positions.values()].flat().reduce((s, r) => s + r.matches, 0);

  const bans: BanSuggestion[] = [];
  for (const hero of data.heroes) {
    if (taken.has(hero.id)) continue;
    const stats = data.positions.get(hero.id);
    const meta = metaScore(stats, 0);
    const reasons: Reason[] = [];

    // Ancaman: seberapa kuat hero ini melawan hero tim kita (tabel `vs` milik kawan, dibalik).
    const threats = allies
      .map((a) => {
        const stat = data.matchups.get(a.id)?.vs.get(hero.id);
        return stat ? { hero: a, adv: -shrinkPair(stat) } : null;
      })
      .filter(Boolean) as { hero: HeroInfo; adv: number }[];
    const threat = mean(threats.map((t) => t.adv));
    const topThreat = [...threats].sort((a, b) => b.adv - a.adv)[0];
    if (topThreat && topThreat.adv >= 1) {
      reasons.push({
        kind: "threat",
        text: `Beats your ${topThreat.hero.name} (${fmt(topThreat.adv)})`,
      });
    }

    // Hero yang jarang dipilih jarang jadi masalah, jadi popularitas ikut dihitung.
    const pickRate = totalMatches ? (meta.matches / totalMatches) * 10 * 100 : 0;
    if (meta.winRate !== null && meta.matches >= 200) {
      reasons.push({
        kind: "meta",
        text: `${(meta.winRate * 100).toFixed(1)}% win rate, picked in ${pickRate.toFixed(0)}% of games`,
      });
    }

    const score = WEIGHTS.banMeta * meta.pp + WEIGHTS.banThreat * threat + 0.05 * pickRate;
    bans.push({ heroId: hero.id, score, reasons });
  }
  bans.sort((a, b) => b.score - a.score);
  return bans.slice(0, BAN_LIMIT);
}

export function compositionWarnings(allies: HeroInfo[], enemies: HeroInfo[]): string[] {
  const warnings: string[] = [];
  const names = (list: HeroInfo[]) => list.map((h) => h.name).join(", ");

  if (allies.length >= 3 && !allies.some((h) => hasRole(h, "Disabler"))) {
    warnings.push("Your team has no reliable disable yet.");
  }
  if (allies.length >= 3 && !allies.some((h) => hasRole(h, "Initiator"))) {
    warnings.push("Nobody on your team is good at starting fights yet.");
  }
  const cores = allies.filter((h) => hasRole(h, "Carry") && !hasRole(h, "Support"));
  if (cores.length >= 3) {
    warnings.push(
      `Your team already has ${cores.length} heroes that want a lot of farm (${names(cores)}).`,
    );
  }

  const slippery = enemies.filter((h) => hasRole(h, "Escape"));
  if (slippery.length >= 2) {
    warnings.push(
      `The enemy has several slippery heroes (${names(slippery)}). Instant disables help.`,
    );
  }
  const pushers = enemies.filter((h) => hasRole(h, "Pusher"));
  if (pushers.length >= 2) {
    warnings.push(
      `The enemy lineup takes towers quickly (${names(pushers)}). Be ready to defend and clear waves early.`,
    );
  }
  return warnings;
}
