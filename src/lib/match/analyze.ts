// Analisis satu pemain di satu match. Fungsi murni: data OpenDota masuk, laporan keluar.

import { formatClock, type HeroInfo } from "@/lib/dota";
import type { ItemConstant, ItemTimingRow, Match, MatchPlayer } from "@/lib/opendota/types";

export const TURBO_GAME_MODE = 23;

export type GradeLetter = "A" | "B" | "C" | "D";

export interface Grade {
  key: "farming" | "experience" | "damage" | "survival" | "fighting";
  label: string;
  letter: GradeLetter;
  /** 0..1, semakin tinggi semakin baik */
  percentile: number;
  detail: string;
  /** False kalau aspek ini kurang penting untuk peran pemain (mis. farming untuk support). */
  relevant: boolean;
}

export interface ItemInfo {
  key: string;
  name: string;
  img: string;
}

export interface Improvement {
  title: string;
  detail: string;
  tip: string;
}

export interface MatchReport {
  matchId: number;
  duration: number;
  startTime: number;
  radiantWin: boolean;
  parsed: boolean;
  player: {
    slot: number;
    heroId: number;
    name: string;
    isRadiant: boolean;
    win: boolean;
    kills: number;
    deaths: number;
    assists: number;
    lastHits: number;
    denies: number;
    gpm: number;
    xpm: number;
    netWorth: number | null;
    heroDamage: number;
    level: number;
    rankTier: number | null;
    role: "core" | "support" | "unknown";
    laneRole: number | null;
  };
  items: ItemInfo[];
  grades: Grade[];
  laning: {
    laneLabel: string;
    lh10: number;
    dn10: number;
    efficiency: number | null;
    goldDiff10: number | null;
    target: number | null;
  } | null;
  deaths: {
    total: number;
    byPhase: { label: string; count: number }[];
    topKillers: { heroId: number; count: number }[];
    timeDead: number;
    goldLost: number;
  } | null;
  itemTimings: {
    item: ItemInfo;
    time: number;
    /** Null kalau pemain membeli lebih lambat dari semua bucket yang punya cukup data. */
    yourBucket: string | null;
    yourWinRate: number | null;
    bestBucket: string;
    bestWinRate: number;
  }[];
  vision: { observers: number; sentries: number; dewards: number; observersPer10: number } | null;
  strengths: string[];
  improvements: Improvement[];
  notes: string[];
}

export interface AnalyzeContext {
  heroes: Map<number, HeroInfo>;
  /** npc_dota_hero_xxx -> hero */
  heroesByKey: Map<string, HeroInfo>;
  items: Record<string, ItemConstant>;
  itemIds: Record<string, string>;
  itemTimings?: ItemTimingRow[];
  assetUrl: (path?: string | null) => string;
}

const LANE_LABEL: Record<number, string> = {
  1: "safe lane",
  2: "mid lane",
  3: "off lane",
  4: "jungle",
};
/** Target kasar last hit di menit 10 untuk core, per lane_role. */
const LH10_TARGET: Record<number, number> = { 1: 50, 2: 50, 3: 35 };
const IGNORED_ITEMS = new Set([
  "ward_observer",
  "ward_sentry",
  "ward_dispenser",
  "tpscroll",
  "smoke_of_deceit",
  "dust",
]);

export function isParsed(match: Match) {
  return Boolean(match.od_data?.has_parsed ?? match.version);
}

export function gradeFor(percentile: number): GradeLetter {
  if (percentile >= 0.75) return "A";
  if (percentile >= 0.5) return "B";
  if (percentile >= 0.25) return "C";
  return "D";
}

function pctOf(player: MatchPlayer, key: string): number | null {
  const b = player.benchmarks?.[key];
  if (!b) return null;
  const v = b.pct_bracket ?? b.pct;
  return Number.isFinite(v) ? v : null;
}

function avg(values: (number | null)[]) {
  const nums = values.filter((v): v is number => v !== null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

/** Persentase untuk teks, dibatasi 1..99 supaya tidak muncul "lebih baik dari 100%". */
function share(p: number) {
  return Math.min(99, Math.max(1, Math.round(p * 100)));
}

function betterThan(p: number) {
  return `better than ${share(p)}% of players on this hero`;
}

/**
 * Peran pemain: dari position_est kalau replay di-parse. Kalau belum, ditebak dari last hit
 * per menit, karena support hampir tidak mengambil farm.
 */
function inferRole(player: MatchPlayer, minutes: number): "core" | "support" | "unknown" {
  if (player.position_est) return player.position_est >= 4 ? "support" : "core";
  if (player.lane_role === 2) return "core";
  const lhPerMin = minutes > 0 ? player.last_hits / minutes : 0;
  if (lhPerMin < 2) return "support";
  if (lhPerMin >= 4) return "core";
  return "unknown";
}

function itemInfo(key: string, ctx: AnalyzeContext): ItemInfo | null {
  const c = ctx.items[key];
  if (!c) return null;
  return { key, name: c.dname ?? key, img: ctx.assetUrl(c.img) };
}

export function analyzeMatch(match: Match, slot: number, ctx: AnalyzeContext): MatchReport {
  const player = match.players.find((p) => p.player_slot === slot);
  if (!player) throw new Error(`No player in slot ${slot}`);

  const parsed = isParsed(match);
  const minutes = match.duration / 60;
  const role = inferRole(player, minutes);
  const notes: string[] = [];

  if (minutes < 15) notes.push("This match was very short, so the numbers below don't say much.");
  if (!player.benchmarks) notes.push("OpenDota has no comparison data for this match yet.");
  if (!parsed) {
    notes.push("Laning, deaths, item timings and vision need the replay to be parsed.");
  }

  // Nilai A-D dari persentil OpenDota (pemain lain dengan hero yang sama).
  const grades: Grade[] = [];
  const addGrade = (
    key: Grade["key"],
    label: string,
    percentile: number | null,
    describe: (p: number) => string,
    relevant = true,
  ) => {
    if (percentile === null) return;
    grades.push({
      key,
      label,
      percentile,
      letter: gradeFor(percentile),
      detail: describe(percentile),
      relevant,
    });
  };

  const isSupport = role === "support";
  addGrade(
    "farming",
    "Farming",
    avg([pctOf(player, "gold_per_min"), pctOf(player, "last_hits_per_min")]),
    (p) => `${player.gold_per_min} gold per minute, ${betterThan(p)}.`,
    !isSupport,
  );
  addGrade(
    "experience",
    "Experience",
    pctOf(player, "xp_per_min"),
    (p) => `${player.xp_per_min} XP per minute, ${betterThan(p)}.`,
  );
  addGrade(
    "damage",
    "Hero damage",
    pctOf(player, "hero_damage_per_min"),
    (p) => `${player.hero_damage.toLocaleString("en-US")} damage to heroes, ${betterThan(p)}.`,
    !isSupport,
  );
  // Persentil kematian dari OpenDota sudah berarti "lebih baik dari X%" (makin tinggi makin
  // jarang mati), jadi tidak dibalik.
  const deathWord = player.deaths === 1 ? "death" : "deaths";
  addGrade("survival", "Survival", pctOf(player, "deaths_per_min"), (p) =>
    p >= 0.5
      ? `${player.deaths} ${deathWord}, fewer than ${share(p)}% of players on this hero.`
      : `${player.deaths} ${deathWord}, more than ${share(1 - p)}% of players on this hero.`,
  );
  if (parsed && player.teamfight_participation != null) {
    const tf = player.teamfight_participation;
    const p = Math.min(1, Math.max(0, (tf - 0.3) / 0.6));
    grades.push({
      key: "fighting",
      label: "Fight participation",
      percentile: p,
      letter: gradeFor(p),
      detail: `You took part in ${Math.round(tf * 100)}% of your team's kills.`,
      relevant: true,
    });
  } else {
    addGrade(
      "fighting",
      "Fight participation",
      avg([pctOf(player, "kills_per_min"), pctOf(player, "assists_per_min")]),
      (p) => `${player.kills} kills and ${player.assists} assists, ${betterThan(p)}.`,
    );
  }

  const teammates = match.players.filter((p) => p.isRadiant === player.isRadiant);
  const opponents = match.players.filter((p) => p.isRadiant !== player.isRadiant);

  // Laning: perlu data per menit dari replay.
  let laning: MatchReport["laning"] = null;
  if (parsed && player.lh_t && player.lh_t.length > 10 && player.lane_role !== 4) {
    const gold10 = (list: MatchPlayer[]) => list.reduce((s, p) => s + (p.gold_t?.[10] ?? 0), 0);
    const sameLane = (p: MatchPlayer) => p.lane != null && p.lane === player.lane;
    const ours = teammates.filter(sameLane);
    const theirs = opponents.filter(sameLane);
    laning = {
      laneLabel: LANE_LABEL[player.lane_role ?? 0] ?? "lane",
      lh10: player.lh_t[10] ?? 0,
      dn10: player.dn_t?.[10] ?? 0,
      efficiency: player.lane_efficiency_pct ?? null,
      goldDiff10: theirs.length ? gold10(ours) - gold10(theirs) : null,
      target: role === "support" ? null : (LH10_TARGET[player.lane_role ?? 0] ?? null),
    };
  }

  // Kematian per fase game dan siapa yang paling sering membunuh.
  let deaths: MatchReport["deaths"] = null;
  if (parsed && player.deaths_log) {
    const phases = [
      { label: "0 to 10 min", from: 0, to: 600 },
      { label: "10 to 20 min", from: 600, to: 1200 },
      { label: "20 to 30 min", from: 1200, to: 1800 },
      { label: "after 30 min", from: 1800, to: Infinity },
    ];
    const topKillers = Object.entries(player.killed_by ?? {})
      .map(([key, count]) => ({ hero: ctx.heroesByKey.get(key), count }))
      .filter((k): k is { hero: HeroInfo; count: number } => Boolean(k.hero))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((k) => ({ heroId: k.hero.id, count: k.count }));
    deaths = {
      total: player.deaths,
      byPhase: phases
        .filter((ph) => ph.from < match.duration)
        .map((ph) => ({
          label: ph.label,
          count: player.deaths_log!.filter((d) => d.time >= ph.from && d.time < ph.to).length,
        })),
      topKillers,
      timeDead: player.deaths_log.reduce((s, d) => s + (d.time_dead ?? 0), 0),
      goldLost: player.deaths_log.reduce((s, d) => s + (d.gold_lost ?? 0), 0),
    };
  }

  // Waktu beli item inti dibanding winrate berdasarkan waktu beli.
  const itemTimings: MatchReport["itemTimings"] = [];
  if (parsed && player.first_purchase_time && ctx.itemTimings?.length) {
    const bought = Object.entries(player.first_purchase_time).filter(([key, t]) => {
      const c = ctx.items[key];
      return t > 0 && !IGNORED_ITEMS.has(key) && c?.components?.length && (c.cost ?? 0) >= 2000;
    });
    // Kaya dan Sange tidak perlu dibahas terpisah kalau Kaya and Sange juga dibeli.
    const partOfAnother = new Set(bought.flatMap(([key]) => ctx.items[key]?.components ?? []));
    const core = bought
      .filter(([key]) => !partOfAnother.has(key))
      .sort((a, b) => a[1] - b[1])
      .slice(0, 4);

    for (const [key, time] of core) {
      const rows = ctx.itemTimings
        .filter((r) => r.item === key && Number(r.games) >= 20)
        .map((r) => ({
          time: r.time,
          games: Number(r.games),
          rate: Number(r.wins) / Number(r.games),
        }))
        .sort((a, b) => a.time - b.time);
      if (rows.length < 2) continue;
      const yours = rows.find((r) => r.time >= time) ?? null;
      // Hanya bandingkan dengan waktu yang lebih cepat. Winrate di waktu lambat terlihat tinggi
      // karena game panjang yang sudah unggul, bukan karena membeli lebih lambat itu bagus.
      const earlier = yours ? rows.filter((r) => r.time < yours.time) : rows;
      const bestEarlier = earlier.length
        ? earlier.reduce((a, b) => (b.rate > a.rate ? b : a))
        : null;
      const best = bestEarlier && (!yours || bestEarlier.rate > yours.rate) ? bestEarlier : yours;
      const info = itemInfo(key, ctx);
      if (!info || !best) continue;
      itemTimings.push({
        item: info,
        time,
        yourBucket: yours ? `by ${formatClock(yours.time)}` : null,
        yourWinRate: yours?.rate ?? null,
        bestBucket: `by ${formatClock(best.time)}`,
        bestWinRate: best.rate,
      });
    }
  }

  let vision: MatchReport["vision"] = null;
  if (parsed && player.obs_placed != null) {
    vision = {
      observers: player.obs_placed ?? 0,
      sentries: player.sen_placed ?? 0,
      dewards: (player.observer_kills ?? 0) + (player.sentry_kills ?? 0),
      observersPer10: minutes > 0 ? ((player.obs_placed ?? 0) / minutes) * 10 : 0,
    };
  }

  const items = [
    player.item_0,
    player.item_1,
    player.item_2,
    player.item_3,
    player.item_4,
    player.item_5,
  ]
    .filter((id) => id > 0)
    .map((id) => itemInfo(ctx.itemIds[String(id)] ?? "", ctx))
    .filter((i): i is ItemInfo => Boolean(i));

  const { strengths, improvements } = summarize({
    grades,
    laning,
    deaths,
    itemTimings,
    vision,
    role,
    ctx,
  });

  return {
    matchId: match.match_id,
    duration: match.duration,
    startTime: match.start_time,
    radiantWin: match.radiant_win,
    parsed,
    player: {
      slot: player.player_slot,
      heroId: player.hero_id,
      name: player.personaname || "Anonymous player",
      isRadiant: player.isRadiant,
      win: Boolean(player.win),
      kills: player.kills,
      deaths: player.deaths,
      assists: player.assists,
      lastHits: player.last_hits,
      denies: player.denies,
      gpm: player.gold_per_min,
      xpm: player.xp_per_min,
      netWorth: player.net_worth ?? null,
      heroDamage: player.hero_damage,
      level: player.level,
      rankTier: player.rank_tier ?? null,
      role,
      laneRole: player.lane_role ?? null,
    },
    items,
    grades,
    laning,
    deaths,
    itemTimings,
    vision,
    strengths,
    improvements,
    notes,
  };
}

function summarize({
  grades,
  laning,
  deaths,
  itemTimings,
  vision,
  role,
  ctx,
}: Pick<MatchReport, "grades" | "laning" | "deaths" | "itemTimings" | "vision"> & {
  role: MatchReport["player"]["role"];
  ctx: AnalyzeContext;
}) {
  const grade = (key: Grade["key"]) => grades.find((g) => g.key === key);
  const weak = (key: Grade["key"]) => {
    const g = grade(key);
    return g && g.relevant && (g.letter === "C" || g.letter === "D") ? g : null;
  };
  const improvements: Improvement[] = [];

  const survival = weak("survival");
  if (survival) {
    const worstPhase = deaths?.byPhase.reduce((a, b) => (b.count > a.count ? b : a));
    const killer = deaths?.topKillers[0];
    const killerName = killer ? ctx.heroes.get(killer.heroId)?.name : null;
    const parts = [survival.detail];
    if (worstPhase && worstPhase.count >= 2) parts.push(`Most of them came ${worstPhase.label}.`);
    if (killerName && killer && killer.count >= 2)
      parts.push(`${killerName} killed you ${killer.count} times.`);
    improvements.push({
      title: "Die less",
      detail: parts.join(" "),
      tip: "Before you farm a risky area, check the minimap for enemy heroes you can't see. If one hero keeps catching you, get a defensive item earlier.",
    });
  }

  if (laning && role === "core") {
    const behind = laning.goldDiff10 !== null && laning.goldDiff10 <= -1000;
    const lowLh = laning.target !== null && laning.lh10 < laning.target * 0.7;
    if (behind || lowLh) {
      const parts = [`At 10 minutes you had ${laning.lh10} last hits`];
      if (laning.target)
        parts[0] += ` (a rough target for the ${laning.laneLabel} is ${laning.target})`;
      if (laning.goldDiff10 !== null) {
        parts.push(
          laning.goldDiff10 < 0
            ? `your lane was ${Math.abs(laning.goldDiff10).toLocaleString("en-US")} gold behind the enemy's`
            : `your lane was ${laning.goldDiff10.toLocaleString("en-US")} gold ahead`,
        );
      }
      improvements.push({
        title: "Win your lane",
        detail: `${parts.join(", and ")}.`,
        tip: "Focus on last hits before trading hits. Pull or stack when the lane is lost so the time isn't wasted.",
      });
    }
  }

  const farming = weak("farming");
  if (farming && role === "core") {
    improvements.push({
      title: "Farm faster",
      detail: farming.detail,
      tip: "When nothing is happening on the map, keep moving between lanes and jungle camps instead of waiting.",
    });
  }

  // Tanpa bucket sendiri (terlalu lambat), selisihnya dianggap besar.
  const gap = (t: MatchReport["itemTimings"][number]) =>
    t.yourWinRate === null ? 1 : t.bestWinRate - t.yourWinRate;
  const late = itemTimings.filter((t) => gap(t) >= 0.03).sort((a, b) => gap(b) - gap(a))[0];
  if (late) {
    const compared =
      late.yourWinRate === null
        ? "That is later than almost everyone who builds it."
        : `Compared with ${Math.round(late.yourWinRate * 100)}% ${late.yourBucket}.`;
    improvements.push({
      title: "Get your core items sooner",
      detail: `You finished ${late.item.name} at ${formatClock(late.time)}. Players who had it ${late.bestBucket} won ${Math.round(late.bestWinRate * 100)}% of the time. ${compared}`,
      tip: "Skip items you don't need yet and spend less time in fights your hero can't win before that item.",
    });
  }

  if (vision && role === "support" && vision.observersPer10 < 1.2) {
    improvements.push({
      title: "Place more wards",
      detail: `You placed ${vision.observers} observer wards, about ${vision.observersPer10.toFixed(1)} every 10 minutes.`,
      tip: "Keep an observer ward on the map most of the time, and move it to where your team plans to fight next.",
    });
  }

  const fighting = weak("fighting");
  if (fighting && fighting.letter === "D") {
    improvements.push({
      title: "Join more fights",
      detail: fighting.detail,
      tip: "Carry a teleport scroll and watch the minimap, so you can join when your team starts a fight.",
    });
  }

  const strengths = grades
    .filter((g) => g.relevant && g.letter === "A")
    .map((g) => `${g.label}: ${g.detail.charAt(0).toLowerCase()}${g.detail.slice(1)}`);
  if (laning?.goldDiff10 != null && laning.goldDiff10 >= 1000) {
    strengths.push(
      `You won your lane by ${laning.goldDiff10.toLocaleString("en-US")} gold at 10 minutes.`,
    );
  }

  return { strengths: strengths.slice(0, 3), improvements: improvements.slice(0, 3) };
}
