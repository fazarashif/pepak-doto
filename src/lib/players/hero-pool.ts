// Analisis hero pool: winrate pribadi dibanding meta di bracket pemain. Fungsi murni.

import type { HeroPositionStat } from "@/lib/stratz/api";

export type Quadrant = "core" | "potential" | "trap" | "avoid";

export const QUADRANT_INFO: Record<Quadrant, { label: string; hint: string }> = {
  core: { label: "Core", hint: "You play these a lot and do better than most players." },
  potential: {
    label: "Potential",
    hint: "Few games so far, but you're doing better than most. Worth more games.",
  },
  trap: {
    label: "Trap",
    hint: "You play these a lot but do worse than most players on them.",
  },
  avoid: { label: "Avoid for now", hint: "Few games and below the average for these heroes." },
};

/** Winrate pribadi ditarik ke winrate meta sebanyak sekian game, supaya sampel kecil tidak ekstrem. */
const SHRINK = 10;
export const FREQUENT_GAMES = 10;
export const MIN_GAMES = 3;
const MIN_POSITION_SHARE = 0.2;

export interface PoolHero {
  heroId: number;
  games: number;
  wins: number;
  /** Winrate pribadi yang sudah dihaluskan. */
  winRate: number;
  /** Winrate hero ini di bracket pemain (semua posisi). */
  metaWinRate: number;
  /** Selisih winrate pribadi dengan meta (poin, 0.05 = 5 poin). */
  edge: number;
  quadrant: Quadrant;
  /** Posisi yang biasa dimainkan hero ini (1..5). */
  positions: number[];
  /** Porsi game hero ini per posisi (index 0 = posisi 1). */
  positionShare: number[];
}

export interface HeroPool {
  heroes: PoolHero[];
  byQuadrant: Record<Quadrant, PoolHero[]>;
  /** Saran hero untuk difokuskan per posisi (1..5). */
  focus: Record<number, PoolHero[]>;
}

export function buildHeroPool(
  played: { hero_id: number; games: number; win: number }[],
  positions: HeroPositionStat[],
): HeroPool {
  const meta = new Map<number, { games: number; wins: number; byPos: number[] }>();
  for (const p of positions) {
    const m = meta.get(p.heroId) ?? { games: 0, wins: 0, byPos: [0, 0, 0, 0, 0] };
    m.games += p.matchCount;
    m.wins += p.winCount;
    if (p.position >= 1 && p.position <= 5) m.byPos[p.position - 1] += p.matchCount;
    meta.set(p.heroId, m);
  }

  const heroes: PoolHero[] = played
    .filter((h) => h.games >= MIN_GAMES && meta.has(h.hero_id))
    .map((h) => {
      const m = meta.get(h.hero_id)!;
      const metaWinRate = m.games ? m.wins / m.games : 0.5;
      const winRate = (h.win + SHRINK * metaWinRate) / (h.games + SHRINK);
      const edge = winRate - metaWinRate;
      const frequent = h.games >= FREQUENT_GAMES;
      const quadrant: Quadrant = frequent
        ? edge >= 0
          ? "core"
          : "trap"
        : edge >= 0
          ? "potential"
          : "avoid";
      const posTotal = m.byPos.reduce((s, x) => s + x, 0);
      return {
        heroId: h.hero_id,
        games: h.games,
        wins: h.win,
        winRate,
        metaWinRate,
        edge,
        quadrant,
        positionShare: m.byPos.map((n) => (posTotal ? n / posTotal : 0)),
        positions: m.byPos
          .map((n, i) => ({ pos: i + 1, share: posTotal ? n / posTotal : 0 }))
          .filter((x) => x.share >= MIN_POSITION_SHARE)
          .map((x) => x.pos),
      };
    });

  const byQuadrant: HeroPool["byQuadrant"] = { core: [], potential: [], trap: [], avoid: [] };
  for (const h of heroes) byQuadrant[h.quadrant].push(h);
  for (const q of Object.keys(byQuadrant) as Quadrant[]) {
    byQuadrant[q].sort((a, b) =>
      q === "trap" || q === "avoid" ? a.edge - b.edge : b.edge - a.edge,
    );
  }

  // Fokus per posisi: hero core dan potential, diurutkan dari keunggulan dan jumlah game.
  const focus: HeroPool["focus"] = {};
  for (let pos = 1; pos <= 5; pos++) {
    focus[pos] = heroes
      .filter(
        (h) => (h.quadrant === "core" || h.quadrant === "potential") && h.positions.includes(pos),
      )
      // Hero yang memang dimainkan di posisi ini lebih diutamakan.
      .sort(
        (a, b) =>
          b.edge * Math.log1p(b.games) * b.positionShare[pos - 1] -
          a.edge * Math.log1p(a.games) * a.positionShare[pos - 1],
      )
      .slice(0, 3);
  }

  return { heroes, byQuadrant, focus };
}
