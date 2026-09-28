// Tren dan pola berulang dari ringkasan match. Fungsi murni.

import { PCT_METRICS, type MatchSummary, type PctMetric } from "./summary";

export const METRIC_LABEL: Record<PctMetric, string> = {
  gpm: "GPM",
  xpm: "XPM",
  lhPerMin: "Last hits",
  deathsPerMin: "Staying alive",
  damagePerMin: "Hero damage",
};

/** Awal kalimat pola per metrik (deathsPerMin punya kalimat sendiri). */
const METRIC_SUBJECT: Record<PctMetric, string> = {
  gpm: "Your GPM is",
  xpm: "Your XPM is",
  lhPerMin: "Your last hits per minute are",
  deathsPerMin: "",
  damagePerMin: "Your hero damage is",
};

const FARM_METRICS = new Set<PctMetric>(["gpm", "xpm", "lhPerMin"]);

const ROLLING = 5;
const MIN_SIDE = 5;
const LONG_GAME = 40 * 60;

export interface Bucket {
  key: string;
  label: string;
  games: number;
  wins: number;
}

export interface Pattern {
  text: string;
  tone: "good" | "bad";
  /** Seberapa kuat polanya, untuk mengurutkan. */
  strength: number;
}

export interface Trends {
  games: number;
  wins: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  /** Rata-rata persentil per metrik (0..1). */
  avgPct: Partial<Record<PctMetric, number>>;
  /** Per metrik: persentil tiap match (lama ke baru) dan rata-rata bergerak 5 match. */
  series: Record<PctMetric, { matchId: number; value: number; rolling: number }[]>;
  byHero: (Bucket & { heroId: number })[];
  byRole: Bucket[];
  byDuration: Bucket[];
  byParty: Bucket[];
  patterns: Pattern[];
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);
const rate = (b: { games: number; wins: number }) => (b.games ? b.wins / b.games : 0);
const pctText = (x: number) => `${Math.round(x * 100)}%`;

function bucket(list: MatchSummary[], key: string, label: string): Bucket {
  return { key, label, games: list.length, wins: list.filter((m) => m.win).length };
}

/** `matches` diurutkan dari yang terbaru (seperti dari OpenDota). */
export function buildTrends(matches: MatchSummary[], heroNames: Map<number, string>): Trends {
  const chrono = [...matches].reverse();

  const series = {} as Trends["series"];
  const avgPct: Trends["avgPct"] = {};
  for (const metric of PCT_METRICS) {
    const points = chrono
      .filter((m) => m.pct[metric] !== undefined)
      .map((m) => ({ matchId: m.matchId, value: m.pct[metric]! }));
    series[metric] = points.map((p, i) => ({
      ...p,
      rolling: mean(points.slice(Math.max(0, i - ROLLING + 1), i + 1).map((x) => x.value)),
    }));
    if (points.length) avgPct[metric] = mean(points.map((p) => p.value));
  }

  const heroIds = [...new Set(matches.map((m) => m.heroId))];
  const byHero = heroIds
    .map((heroId) => ({
      heroId,
      ...bucket(
        matches.filter((m) => m.heroId === heroId),
        String(heroId),
        heroNames.get(heroId) ?? `Hero ${heroId}`,
      ),
    }))
    .sort((a, b) => b.games - a.games || b.wins - a.wins);

  const byRole = [
    bucket(
      matches.filter((m) => m.role === "core"),
      "core",
      "Core",
    ),
    bucket(
      matches.filter((m) => m.role === "support"),
      "support",
      "Support",
    ),
  ].filter((b) => b.games);

  const byDuration = [
    bucket(
      matches.filter((m) => m.duration < 30 * 60),
      "short",
      "Under 30 min",
    ),
    bucket(
      matches.filter((m) => m.duration >= 30 * 60 && m.duration < LONG_GAME),
      "mid",
      "30 to 40 min",
    ),
    bucket(
      matches.filter((m) => m.duration >= LONG_GAME && m.duration < 50 * 60),
      "long",
      "40 to 50 min",
    ),
    bucket(
      matches.filter((m) => m.duration >= 50 * 60),
      "vlong",
      "50 min or more",
    ),
  ].filter((b) => b.games);

  const known = matches.filter((m) => m.partySize !== null);
  const byParty = [
    bucket(
      known.filter((m) => m.partySize === 1),
      "solo",
      "Solo",
    ),
    bucket(
      known.filter((m) => (m.partySize ?? 0) > 1),
      "party",
      "In a party",
    ),
  ].filter((b) => b.games);

  return {
    games: matches.length,
    wins: matches.filter((m) => m.win).length,
    avgKills: mean(matches.map((m) => m.kills)),
    avgDeaths: mean(matches.map((m) => m.deaths)),
    avgAssists: mean(matches.map((m) => m.assists)),
    avgPct,
    series,
    byHero,
    byRole,
    byDuration,
    byParty,
    patterns: findPatterns(matches, avgPct, byHero),
  };
}

/** Pola berulang, ditulis sebagai kalimat. Hanya yang sampelnya cukup. */
export function findPatterns(
  matches: MatchSummary[],
  avgPct: Partial<Record<PctMetric, number>>,
  byHero: (Bucket & { heroId: number })[],
): Pattern[] {
  const out: Pattern[] = [];
  const wins = matches.filter((m) => m.win);
  const losses = matches.filter((m) => !m.win);

  // Kematian di game kalah vs menang.
  if (wins.length >= MIN_SIDE && losses.length >= MIN_SIDE) {
    const dl = mean(losses.map((m) => m.deaths));
    const dw = mean(wins.map((m) => m.deaths));
    if (dw > 0 && dl / dw >= 1.5) {
      out.push({
        tone: "bad",
        strength: dl / dw,
        text: `In games you lose you die ${dl.toFixed(1)} times on average, against ${dw.toFixed(1)} in wins. Dying less is the quickest win here.`,
      });
    }
  }

  // Game panjang vs pendek.
  const long = matches.filter((m) => m.duration >= LONG_GAME);
  const short = matches.filter((m) => m.duration < LONG_GAME);
  if (long.length >= MIN_SIDE + 1 && short.length >= MIN_SIDE + 1) {
    const wl = rate(bucket(long, "", ""));
    const ws = rate(bucket(short, "", ""));
    if (Math.abs(wl - ws) >= 0.15) {
      out.push({
        tone: wl < ws ? "bad" : "good",
        strength: Math.abs(wl - ws) * 4,
        text:
          wl < ws
            ? `You win ${pctText(wl)} of games longer than 40 minutes and ${pctText(ws)} of shorter ones. Try to close games out earlier.`
            : `You win ${pctText(wl)} of games longer than 40 minutes and ${pctText(ws)} of shorter ones. You're at your best in long games.`,
      });
    }
  }

  // Solo vs party.
  const solo = matches.filter((m) => m.partySize === 1);
  const party = matches.filter((m) => (m.partySize ?? 0) > 1);
  if (solo.length >= MIN_SIDE && party.length >= MIN_SIDE) {
    const a = rate(bucket(solo, "", ""));
    const b = rate(bucket(party, "", ""));
    if (Math.abs(a - b) >= 0.15) {
      out.push({
        tone: "good",
        strength: Math.abs(a - b) * 3,
        text: `You win ${pctText(b)} of games in a party and ${pctText(a)} solo.`,
      });
    }
  }

  // Metrik terlemah dan terkuat dibanding pemain lain di hero yang sama.
  // Pemain yang kebanyakan support tidak dinilai dari farming.
  const mostlySupport =
    matches.length > 0 &&
    matches.filter((m) => m.role === "support").length / matches.length >= 0.6;
  const ranked = (Object.entries(avgPct) as [PctMetric, number][])
    .filter(([metric]) => !(mostlySupport && FARM_METRICS.has(metric)))
    .sort((a, b) => a[1] - b[1]);
  const weakest = ranked[0];
  const strongest = ranked.at(-1);
  if (weakest && weakest[1] < 0.35) {
    out.push({
      tone: "bad",
      strength: (0.5 - weakest[1]) * 6,
      text:
        weakest[0] === "deathsPerMin"
          ? `You die more than ${pctText(1 - weakest[1])} of players on the same heroes.`
          : `${METRIC_SUBJECT[weakest[0]]} usually lower than ${pctText(1 - weakest[1])} of players on the same heroes.`,
    });
  }
  if (strongest && strongest !== weakest && strongest[1] > 0.65) {
    out.push({
      tone: "good",
      strength: (strongest[1] - 0.5) * 5,
      text:
        strongest[0] === "deathsPerMin"
          ? `You die less than ${pctText(strongest[1])} of players on the same heroes.`
          : `${METRIC_SUBJECT[strongest[0]]} better than ${pctText(strongest[1])} of players on the same heroes.`,
    });
  }

  // Hero yang terus kalah atau terus menang.
  for (const h of byHero) {
    if (h.games < MIN_SIDE) continue;
    const wr = rate(h);
    if (wr <= 0.35) {
      out.push({
        tone: "bad",
        strength: (0.5 - wr) * 4,
        text: `You've lost ${h.games - h.wins} of your last ${h.games} games on ${h.label}.`,
      });
    } else if (wr >= 0.65) {
      out.push({
        tone: "good",
        strength: (wr - 0.5) * 4,
        text: `You've won ${h.wins} of your last ${h.games} games on ${h.label}.`,
      });
    }
  }

  // Naik atau turun: 10 match terakhir dibanding sebelumnya.
  if (matches.length >= 20) {
    const avgOf = (list: MatchSummary[]) =>
      mean(
        list.flatMap((m) => Object.values(m.pct).filter((v): v is number => typeof v === "number")),
      );
    const recent = avgOf(matches.slice(0, 10));
    const before = avgOf(matches.slice(10));
    const diff = recent - before;
    if (Math.abs(diff) >= 0.08) {
      out.push({
        tone: diff > 0 ? "good" : "bad",
        strength: Math.abs(diff) * 8,
        text:
          diff > 0
            ? `Your last 10 games are clearly better than the ones before them.`
            : `Your last 10 games are weaker than the ones before them. Tiredness or tilt can do that.`,
      });
    }
  }

  return out.sort((a, b) => b.strength - a.strength).slice(0, 5);
}
