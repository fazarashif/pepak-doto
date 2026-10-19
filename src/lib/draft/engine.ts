// Mesin rekomendasi draft. Fungsi murni: data masuk, rekomendasi keluar, tanpa fetch.
// Semua angka dalam poin persen (pp): +2 berarti sekitar 2% lebih sering menang.
//
// Draft mengikuti Ranked All Pick dengan role queue: tiap tim punya posisi 1..5, dan pick
// dilakukan dalam 3 ronde (2, 2, lalu 1 hero per tim). Pick dalam satu ronde tidak terlihat
// lawan sampai ronde selesai, jadi hero yang di-pick di ronde awal bisa di-counter belakangan.

import type { HeroInfo } from "@/lib/dota";
import { PAIR_SHRINK, type VsMatrix } from "./matrix";
import { ALL_POSITIONS, laneOf, laneOpponents, type Lane } from "./positions";

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
  /** Keunggulan semua hero melawan semua hero, untuk menilai musuh yang belum di-pick. */
  vsMatrix?: VsMatrix;
  /** Hero pool user yang login. */
  pool?: Map<number, { games: number; wins: number }>;
}

/** Hero di satu posisi (1..5). */
export interface DraftSlot {
  heroId: number;
  position: number;
}

export type DraftRound = 1 | 2 | 3;

export interface DraftInput {
  allies: DraftSlot[];
  /** Posisi musuh sudah ditentukan (ditebak atau diisi user). */
  enemies: DraftSlot[];
  bans: number[];
  /** Posisi user, 0 kalau tidak diisi. */
  position: number;
  /** Ronde pick yang sedang berjalan, dipilih user. */
  round: DraftRound;
  poolOnly: boolean;
  /** Nama bracket untuk teks alasan, mis. "Legend and Ancient" */
  bracketLabel: string;
}

export type ReasonKind =
  "counter" | "weak" | "synergy" | "meta" | "pool" | "team" | "threat" | "blind";

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

export interface PositionPicks {
  position: number;
  suggestions: PickSuggestion[];
}

export interface BanSuggestion {
  heroId: number;
  score: number;
  reasons: Reason[];
}

export interface LaneOutlook {
  lane: Lane;
  allies: number[];
  enemies: number[];
  /** Rata-rata keunggulan hero kita melawan hero musuh di lane itu (pp). */
  advantage: number;
  verdict: "favored" | "even" | "tough";
}

export interface DraftResult {
  /** Saran untuk tiap posisi tim yang masih kosong; posisi user di depan. */
  picks: PositionPicks[];
  bans: BanSuggestion[];
  lanes: LaneOutlook[];
  warnings: string[];
}

// Dikalibrasi dengan `npm run backtest` (3.899 match publik, 5-fold cross-validation, 2026-09-28):
// 1 / 0.2 / 0.5 memberi akurasi 56.3% dan AUC 0.591, sedikit di atas 1 / 0.6 / 0.7 (55.9%, 0.588).
// Synergy ternyata lemah sebagai prediktor, jadi bobotnya kecil; meta paling kuat.
export const WEIGHTS = { counter: 1.0, synergy: 0.2, meta: 0.5, banThreat: 1.0, banMeta: 0.7 };
/**
 * Lawan satu lane dihitung dua kali lipat. Backtest 2026-10-19 (3.944 match, posisi ditebak
 * dari statistik posisi): akurasi 57.1% dan AUC 0.594, dari 56.3% dan 0.591 tanpa bobot lane.
 * Bobot 2 sedikit lebih baik dari 1, 3 dan 5, tapi bedanya masih di dalam noise (±1.6 poin).
 */
export const LANE_WEIGHT = 2;
/**
 * Pick musuh setelah ronde ini, yang bisa memilih counter karena sudah melihat pick kita.
 * Ronde 1: 2 pick di ronde 2 dan 1 di ronde 3. Ronde 2: 1 pick di ronde 3. Ronde 3: tidak ada.
 */
export const PICKS_AFTER_ROUND: Record<DraftRound, number> = { 1: 3, 2: 1, 3: 0 };
/** Untuk musuh yang memilih setelah melihat kita: setengah jalan antara rata-rata dan counter terburuk. */
const RESPONSE_PENALTY = 0.5;
/** Hero terpopuler per posisi yang dianggap sebagai calon counter. */
const THREAT_POOL = 15;
/**
 * Label "mudah di-counter" dan "sulit di-counter" diberikan ke 20% hero terbawah dan teratas
 * menurut risiko counter, dibandingkan antar hero di draft yang sama. Batas tetap tidak cocok:
 * dengan data lengkap hampir semua hero punya satu counter -2.5% atau lebih buruk di antara
 * hero populer (83-92% hero di tiap kelompok rank, data backtest 2026-10-19).
 */
const RISK_TAIL = 0.2;
/** Label "mudah di-counter" hanya kalau risikonya juga cukup besar, bukan sekadar terbawah. */
const MIN_RISK_TO_WARN = -1.5;
const META_SHRINK = 500;
const POOL_SHRINK = 10;
export const MIN_POSITION_SHARE = 0.1;
export const MIN_POOL_GAMES = 5;
const PICK_LIMIT = 10;
const BAN_LIMIT = 5;

export const POSITION_NAMES = ["", "carry", "mid", "offlane", "soft support", "hard support"];

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

/** Keunggulan hero melawan satu musuh yang sudah terlihat, dari tabel `vs` milik musuh itu. */
function advantageVs(heroId: number, enemyId: number, data: DraftData) {
  const stat = data.matchups.get(enemyId)?.vs.get(heroId);
  return stat ? -shrinkPair(stat) : null;
}

/**
 * Keunggulan hero melawan tiap musuh, dari tabel `vs` milik musuh itu (tandanya dibalik).
 * Rata-rata biasa tanpa posisi; dipakai script backtest.
 */
export function counterAgainst(heroId: number, enemyIds: number[], data: DraftData) {
  const items = enemyIds
    .map((id) => {
      const value = advantageVs(heroId, id, data);
      return value === null ? null : { id, value };
    })
    .filter((x): x is { id: number; value: number } => x !== null);
  return { mean: mean(items.map((i) => i.value)), items };
}

/**
 * Counter dengan posisi: rata-rata tertimbang atas kelima posisi musuh. Lawan satu lane
 * berbobot LANE_WEIGHT. Posisi musuh yang masih kosong dinilai dengan `unknown(position)`
 * (null berarti tidak ada data, posisi itu dilewati).
 */
export function laneCounter(
  heroId: number,
  position: number,
  enemies: DraftSlot[],
  data: DraftData,
  unknown: (enemyPosition: number) => number | null = () => null,
) {
  const opponents = laneOpponents(position);
  let sum = 0;
  let weights = 0;
  for (const q of ALL_POSITIONS) {
    const enemy = enemies.find((e) => e.position === q);
    const value = enemy ? advantageVs(heroId, enemy.heroId, data) : unknown(q);
    if (value === null) continue;
    const w = opponents.includes(q) ? LANE_WEIGHT : 1;
    sum += w * value;
    weights += w;
  }
  return weights ? sum / weights : 0;
}

/** Synergy hero dengan tiap kawan, dari tabel `with` milik kawan itu. */
export function synergyWith(heroId: number, allyIds: number[], data: DraftData) {
  const items = allyIds
    .map((id) => {
      const stat = data.matchups.get(id)?.with.get(heroId);
      return stat ? { id, value: shrinkPair(stat) } : null;
    })
    .filter((x): x is { id: number; value: number } => x !== null);
  return { mean: mean(items.map((i) => i.value)), items };
}

interface UnknownEstimate {
  /** Rata-rata keunggulan melawan hero yang biasa main di posisi itu, ditimbang popularitas. */
  expected: number;
  /** Rata-rata dua counter terburuk di antara hero terpopuler di posisi itu. */
  worst: number;
  worstHeroId: number | null;
  worstValue: number;
}

/**
 * Siapkan penilaian musuh yang belum di-pick. Calon musuh per posisi: hero yang belum diambil
 * dan cukup sering main di posisi itu.
 */
function unknownEstimator(data: DraftData, taken: Set<number>) {
  const matrix = data.vsMatrix;
  if (!matrix) return null;

  const candidates = new Map<number, { heroId: number; weight: number }[]>();
  for (const q of ALL_POSITIONS) {
    const list: { heroId: number; weight: number }[] = [];
    for (const [heroId, stats] of data.positions) {
      if (taken.has(heroId)) continue;
      const share = positionShare(stats, q);
      if (share === null || share < MIN_POSITION_SHARE) continue;
      list.push({ heroId, weight: stats[q - 1]?.matches ?? 0 });
    }
    list.sort((a, b) => b.weight - a.weight);
    candidates.set(q, list);
  }

  const memo = new Map<string, UnknownEstimate | null>();
  return (heroId: number, q: number): UnknownEstimate | null => {
    const key = `${heroId}:${q}`;
    if (memo.has(key)) return memo.get(key)!;
    const row = matrix[heroId];
    let result: UnknownEstimate | null = null;
    if (row) {
      let sum = 0;
      let weights = 0;
      const threats: { heroId: number; value: number }[] = [];
      for (const c of candidates.get(q) ?? []) {
        if (c.heroId === heroId) continue;
        const value = row[c.heroId];
        if (value === undefined) continue;
        sum += c.weight * value;
        weights += c.weight;
        if (threats.length < THREAT_POOL) threats.push({ heroId: c.heroId, value });
      }
      if (weights > 0) {
        threats.sort((a, b) => a.value - b.value);
        const expected = sum / weights;
        result = {
          expected,
          worst: threats.length ? mean(threats.slice(0, 2).map((t) => t.value)) : expected,
          worstHeroId: threats[0]?.heroId ?? null,
          worstValue: threats[0]?.value ?? 0,
        };
      }
    }
    memo.set(key, result);
    return result;
  };
}

/**
 * Risiko di-counter oleh pick musuh berikutnya: rata-rata, atas posisi musuh yang masih
 * kosong, dari dua counter terburuk di posisi itu. Juga mengembalikan satu counter terburuk
 * sebagai contoh. Null kalau datanya tidak ada.
 */
function counterRisk(
  heroId: number,
  openEnemy: number[],
  estimate: NonNullable<ReturnType<typeof unknownEstimator>>,
) {
  const threats = openEnemy
    .map((q) => estimate(heroId, q))
    .filter((t): t is UnknownEstimate => t !== null && t.worstHeroId !== null);
  if (!threats.length) return null;
  const worst = threats.reduce((a, b) => (b.worstValue < a.worstValue ? b : a));
  return { risk: mean(threats.map((t) => t.worst)), worst };
}

/** Batas 20% terbawah dan teratas risiko counter di antara semua hero yang belum diambil. */
function riskCutoffs(
  data: DraftData,
  taken: Set<number>,
  openEnemy: number[],
  estimate: NonNullable<ReturnType<typeof unknownEstimator>>,
) {
  const risks = data.heroes
    .filter((h) => !taken.has(h.id))
    .map((h) => counterRisk(h.id, openEnemy, estimate)?.risk)
    .filter((r): r is number => r !== undefined)
    .sort((a, b) => a - b);
  if (!risks.length) return null;
  const at = (p: number) => risks[Math.round((risks.length - 1) * p)];
  return { low: at(RISK_TAIL), high: at(1 - RISK_TAIL) };
}

export function openPositions(allies: DraftSlot[]) {
  return ALL_POSITIONS.filter((p) => !allies.some((a) => a.position === p));
}

export function recommend(input: DraftInput, data: DraftData): DraftResult {
  const byId = new Map(data.heroes.map((h) => [h.id, h]));
  const allyIds = input.allies.map((a) => a.heroId);
  const enemyIds = input.enemies.map((e) => e.heroId);
  const taken = new Set([...allyIds, ...enemyIds, ...input.bans]);
  const allies = allyIds.map((id) => byId.get(id)).filter(Boolean) as HeroInfo[];
  const enemies = enemyIds.map((id) => byId.get(id)).filter(Boolean) as HeroInfo[];

  const estimate = unknownEstimator(data, taken);
  const openEnemy = ALL_POSITIONS.filter((p) => !input.enemies.some((e) => e.position === p));
  const responders = Math.min(openEnemy.length, PICKS_AFTER_ROUND[input.round]);
  const responseShare = openEnemy.length ? responders / openEnemy.length : 0;
  // Label risiko counter hanya berarti kalau masih ada musuh yang akan memilih setelah kita.
  const riskCut =
    estimate && responseShare > 0 && openEnemy.length >= 2
      ? riskCutoffs(data, taken, openEnemy, estimate)
      : null;

  const open = openPositions(input.allies).sort(
    (a, b) => Number(b === input.position) - Number(a === input.position),
  );

  const picks = open.map((position) => ({
    position,
    suggestions: suggestFor(position, {
      input,
      data,
      byId,
      taken,
      allies,
      enemies,
      estimate,
      openEnemy,
      responseShare,
      riskCut,
    }),
  }));

  return {
    picks,
    bans: suggestBans(input, data, byId, taken),
    lanes: laneOutlook(input, data),
    warnings: compositionWarnings(allies, enemies),
  };
}

interface Context {
  input: DraftInput;
  data: DraftData;
  byId: Map<number, HeroInfo>;
  taken: Set<number>;
  allies: HeroInfo[];
  enemies: HeroInfo[];
  estimate: ReturnType<typeof unknownEstimator>;
  openEnemy: number[];
  /** Bagian posisi musuh yang masih kosong yang akan memilih setelah melihat pick ini. */
  responseShare: number;
  riskCut: { low: number; high: number } | null;
}

function suggestFor(position: number, ctx: Context): PickSuggestion[] {
  const { input, data, byId, taken, allies, enemies, estimate, openEnemy, responseShare, riskCut } =
    ctx;
  const forUser = position === input.position;
  const opponents = laneOpponents(position);

  const teamLacks = (role: string) => allies.length >= 2 && !allies.some((h) => hasRole(h, role));
  const slipperyEnemies = enemies.filter((h) => hasRole(h, "Escape"));

  const picks: PickSuggestion[] = [];

  for (const hero of data.heroes) {
    if (taken.has(hero.id)) continue;
    const stats = data.positions.get(hero.id);

    const share = positionShare(stats, position);
    if (share !== null && share < MIN_POSITION_SHARE) continue;

    const poolEntry = forUser ? data.pool?.get(hero.id) : undefined;
    if (forUser && input.poolOnly && (!poolEntry || poolEntry.games < MIN_POOL_GAMES)) continue;

    const reasons: Reason[] = [];

    const unknownValue = (q: number) => {
      const est = estimate?.(hero.id, q);
      if (!est) return null;
      return est.expected + responseShare * RESPONSE_PENALTY * (est.worst - est.expected);
    };
    const counter = laneCounter(hero.id, position, input.enemies, data, unknownValue);

    const seen = input.enemies
      .map((e) => ({ e, hero: byId.get(e.heroId), adv: advantageVs(hero.id, e.heroId, data) }))
      .filter((v): v is { e: DraftSlot; hero: HeroInfo; adv: number } => !!v.hero && v.adv !== null)
      .sort((a, b) => b.adv - a.adv);
    for (const v of seen.slice(0, 2)) {
      if (v.adv >= 1) {
        const where = opponents.includes(v.e.position) ? " in lane" : "";
        reasons.push({
          kind: "counter",
          text: `Strong against ${v.hero.name}${where} (${fmt(v.adv)})`,
        });
      }
    }
    const worstSeen = seen.at(-1);
    if (worstSeen && worstSeen.adv <= -1.5) {
      const where = opponents.includes(worstSeen.e.position) ? " in lane" : "";
      reasons.push({
        kind: "weak",
        text: `Struggles against ${worstSeen.hero.name}${where} (${fmt(worstSeen.adv)})`,
      });
    }

    // Musuh yang belum di-pick: apakah hero ini mudah di-counter di ronde berikutnya?
    const risk = riskCut && estimate ? counterRisk(hero.id, openEnemy, estimate) : null;
    if (riskCut && risk) {
      const worstHero = risk.worst.worstHeroId ? byId.get(risk.worst.worstHeroId) : undefined;
      // Kalau semua hero sama risikonya (batas bawah = batas atas), tidak ada yang diberi label.
      const spread = riskCut.low < riskCut.high;
      if (worstHero && spread && risk.risk <= riskCut.low && risk.risk <= MIN_RISK_TO_WARN) {
        reasons.push({
          kind: "weak",
          text: `Easy to counter later, e.g. by ${worstHero.name} (${fmt(risk.worst.worstValue)})`,
        });
      } else if (spread && risk.risk >= riskCut.high) {
        reasons.push({
          kind: "blind",
          text:
            input.round === 1
              ? "Few hard counters, safe to pick early"
              : "Hard to counter with their last pick",
        });
      }
    }

    const withAllies = synergyWith(
      hero.id,
      ctx.input.allies.map((a) => a.heroId),
      data,
    );
    const synergy = withAllies.mean;
    const bestAlly = withAllies.items
      .map((i) => ({ hero: byId.get(i.id)!, syn: i.value }))
      .filter((w) => w.hero)
      .sort((a, b) => b.syn - a.syn)[0];
    if (bestAlly && bestAlly.syn >= 1) {
      reasons.push({
        kind: "synergy",
        text: `Pairs well with ${bestAlly.hero.name} (${fmt(bestAlly.syn)})`,
      });
    }

    const meta = metaScore(stats, position);
    if (meta.winRate !== null && meta.matches >= 200) {
      reasons.push({
        kind: "meta",
        text: `${(meta.winRate * 100).toFixed(1)}% win rate as ${POSITION_NAMES[position]} in ${input.bracketLabel}`,
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
  return picks.slice(0, PICK_LIMIT);
}

function suggestBans(
  input: DraftInput,
  data: DraftData,
  byId: Map<number, HeroInfo>,
  taken: Set<number>,
): BanSuggestion[] {
  const allies = input.allies.map((a) => byId.get(a.heroId)).filter(Boolean) as HeroInfo[];
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

const LANE_ORDER: Lane[] = ["safe", "mid", "off"];
const OUR_LANE_POSITIONS: Record<Lane, number[]> = { safe: [1, 5], mid: [2], off: [3, 4] };

/** Perkiraan tiap lane, untuk lane yang kedua sisinya sudah punya hero. */
export function laneOutlook(input: DraftInput, data: DraftData): LaneOutlook[] {
  const out: LaneOutlook[] = [];
  for (const lane of LANE_ORDER) {
    const ours = input.allies.filter((a) => laneOf(a.position) === lane);
    const theirPositions = laneOpponents(OUR_LANE_POSITIONS[lane][0]);
    const theirs = input.enemies.filter((e) => theirPositions.includes(e.position));
    if (!ours.length || !theirs.length) continue;

    const values: number[] = [];
    for (const a of ours) {
      for (const e of theirs) {
        const v = advantageVs(a.heroId, e.heroId, data);
        if (v !== null) values.push(v);
      }
    }
    if (!values.length) continue;
    const advantage = mean(values);
    out.push({
      lane,
      allies: ours.sort((x, y) => x.position - y.position).map((a) => a.heroId),
      enemies: theirs.sort((x, y) => x.position - y.position).map((e) => e.heroId),
      advantage,
      verdict: advantage >= 1.5 ? "favored" : advantage <= -1.5 ? "tough" : "even",
    });
  }
  return out;
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
