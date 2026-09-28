// Rencana permainan: kapan tim paling kuat dan skill musuh yang perlu diwaspadai.
// Fungsi murni; datanya disiapkan src/lib/live/data.ts.

import type { DurationBin } from "@/lib/hero-data/types";
import type { GameState } from "@/lib/items/advisor";
import type { HeroTraitsFile } from "@/lib/items/traits";

export interface AbilityInfo {
  key: string;
  name: string;
  bkbPierce: boolean;
}

export interface PowerPoint {
  /** Awal bin 5 menit, mis. 25 berarti game yang selesai di menit 25-29. */
  minute: number;
  /** Rata-rata selisih winrate hero di durasi ini dengan winrate keseluruhannya, dalam poin (0.05 = 5 poin). */
  allies: number;
  enemies: number;
}

export type Timing = "early" | "late" | "even";

export interface EnemyDanger {
  heroId: number;
  heroName: string;
  abilities: AbilityInfo[];
}

export interface GamePlan {
  curve: PowerPoint[];
  timing: Timing;
  /** Menit ketika keunggulan berpindah tim, kalau ada. */
  switchMinute: number | null;
  summary: string;
  stateTip: string | null;
  dangers: EnemyDanger[];
}

export const CURVE_FROM = 15;
export const CURVE_TO = 60;
const SHRINK = 100;
const EARLY_BINS = [15, 20, 25, 30];
const LATE_BINS = [40, 45, 50, 55, 60];
const TIMING_GAP = 0.025;

/** Kekuatan hero per bin durasi, relatif terhadap winrate keseluruhannya. */
export function heroStrength(bins: DurationBin[]): Map<number, number> {
  const games = bins.reduce((s, b) => s + b[1], 0);
  const wins = bins.reduce((s, b) => s + b[2], 0);
  const out = new Map<number, number>();
  if (!games) return out;
  const overall = wins / games;

  const grouped = new Map<number, { n: number; w: number }>();
  for (const [minute, n, w] of bins) {
    const key = Math.min(Math.max(minute, CURVE_FROM), CURVE_TO);
    const g = grouped.get(key) ?? { n: 0, w: 0 };
    g.n += n;
    g.w += w;
    grouped.set(key, g);
  }
  for (let m = CURVE_FROM; m <= CURVE_TO; m += 5) {
    const g = grouped.get(m) ?? { n: 0, w: 0 };
    // Bin dengan sedikit game ditarik ke winrate keseluruhan supaya tidak ekstrem.
    const smoothed = (g.w + SHRINK * overall) / (g.n + SHRINK);
    out.set(m, smoothed - overall);
  }
  return out;
}

function teamStrength(ids: number[], durations: Map<number, DurationBin[]>, minute: number) {
  const values = ids
    .map((id) => durations.get(id))
    .filter((b): b is DurationBin[] => Boolean(b?.length))
    .map((b) => heroStrength(b).get(minute) ?? 0);
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

export function buildGamePlan(input: {
  allies: number[];
  enemies: number[];
  state: GameState;
  durations: Map<number, DurationBin[]>;
  traits: HeroTraitsFile;
  abilities: Map<string, AbilityInfo>;
  heroNames: Map<number, string>;
}): GamePlan {
  const curve: PowerPoint[] = [];
  for (let m = CURVE_FROM; m <= CURVE_TO; m += 5) {
    curve.push({
      minute: m,
      allies: teamStrength(input.allies, input.durations, m),
      enemies: teamStrength(input.enemies, input.durations, m),
    });
  }
  const edge = (p: PowerPoint) => p.allies - p.enemies;
  const early = mean(curve.filter((p) => EARLY_BINS.includes(p.minute)).map(edge));
  const late = mean(curve.filter((p) => LATE_BINS.includes(p.minute)).map(edge));

  let timing: Timing = "even";
  if (early - late > TIMING_GAP) timing = "early";
  else if (late - early > TIMING_GAP) timing = "late";

  // Menit pertama ketika tanda keunggulan berbalik ke arah yang diharapkan.
  let switchMinute: number | null = null;
  if (timing !== "even") {
    for (let i = 1; i < curve.length; i++) {
      const before = edge(curve[i - 1]);
      const now = edge(curve[i]);
      if (timing === "early" ? before >= 0 && now < 0 : before <= 0 && now > 0) {
        switchMinute = curve[i].minute;
        break;
      }
    }
  }

  const around = switchMinute ?? 35;
  const summary =
    timing === "early"
      ? `Your lineup is stronger in shorter games, until about minute ${around}. Group up, take fights and objectives early, and don't give them time to farm.`
      : timing === "late"
        ? `Their lineup is stronger in shorter games. Play safe and farm, avoid even fights, and look to fight after about minute ${around}.`
        : "Neither lineup has a clear timing edge. Play around your own item timings.";

  const stateTip =
    input.state === "behind"
      ? "You're behind: farm the safer side of the map, defend towers together, and get the defensive items first."
      : input.state === "ahead"
        ? "You're ahead: take towers and Roshan while their key items aren't done, and don't chase into fog."
        : null;

  const dangers: EnemyDanger[] = input.enemies
    .map((heroId) => {
      const entry = input.traits.heroes[String(heroId)];
      // Data OpenDota juga menandai serangan fisik sebagai "menembus BKB". Tanda ini hanya
      // ditampilkan untuk hero yang memang punya disable menembus BKB (dicek manual).
      const piercing = entry?.traits.includes("bkbPierce") ?? false;
      return {
        heroId,
        heroName: input.heroNames.get(heroId) ?? `Hero ${heroId}`,
        abilities: (entry?.dangerous ?? [])
          .map((k) => input.abilities.get(k))
          .filter((a): a is AbilityInfo => Boolean(a))
          .map((a) => ({ ...a, bkbPierce: a.bkbPierce && piercing })),
      };
    })
    .filter((d) => d.abilities.length);

  return { curve, timing, switchMinute, summary, stateTip, dangers };
}
