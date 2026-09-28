// Data hero yang disinkron tiap hari ke tabel `hero_data`.
// Tanpa ketergantungan ke Next.js, supaya bisa dipakai script sinkron.

import type { HeroMatchups, HeroPositionStat, HeroProfile, RawHeroItems } from "@/lib/stratz/api";
import type { StratzBracket } from "@/lib/stratz/brackets";

export type HeroDataKind = "positions" | "profiles" | "matchups" | "items" | "durations";

/** Satu baris `hero_data`. heroId 0 dan position 0 berarti "semua". */
export interface HeroDataRow<T = unknown> {
  kind: HeroDataKind;
  bracket: StratzBracket;
  heroId: number;
  position: number;
  source: "stratz" | "opendota";
  value: T;
}

export interface HeroDataValues {
  positions: HeroPositionStat[];
  profiles: HeroProfile[];
  matchups: HeroMatchups;
  items: ItemBuild;
  durations: DurationBin[];
}

/** [menit awal bin, jumlah game, jumlah menang]. Bin 5 menit dari OpenDota. */
export type DurationBin = [minute: number, games: number, wins: number];

export interface StartingItem {
  itemId: number;
  /** Jumlah yang biasa dibeli (mis. 2 Tango). */
  count: number;
  matches: number;
  wins: number;
}

export interface BootItem {
  itemId: number;
  matches: number;
  wins: number;
  /** Rata-rata waktu beli, detik. */
  avgTime: number;
}

/** [menit, jumlah match yang membeli di menit itu, menang]. */
export type TimingPoint = [minute: number, matches: number, wins: number];

export interface BuildItem {
  itemId: number;
  matches: number;
  wins: number;
  /** Menit beli median. */
  medianMinute: number;
  timing: TimingPoint[];
}

export interface ItemBuild {
  /** Perkiraan jumlah match hero ini di posisi ini (penyebut untuk persentase). */
  games: number;
  starting: StartingItem[];
  boots: BootItem[];
  items: BuildItem[];
}

const MIN_START_SHARE = 0.1;
const MIN_BOOT_SHARE = 0.03;
const MIN_ITEM_SHARE = 0.03;
const MIN_TIMING_MATCHES = 20;

/**
 * Ringkas data mentah STRATZ supaya yang disimpan hanya item yang cukup sering dibeli.
 *
 * `positionGames` berasal dari statistik posisi, yang periodenya lebih pendek dari statistik
 * item. Karena itu penyebutnya diambil yang terbesar antara angka itu dan jumlah pembeli item
 * terlaris, supaya persentase tidak lewat 100%.
 */
export function summarizeItems(raw: RawHeroItems, positionGames: number): ItemBuild {
  const firstBuys = new Map<number, number>();
  for (const r of raw.full) {
    if (r.instance === 0) firstBuys.set(r.itemId, (firstBuys.get(r.itemId) ?? 0) + r.matchCount);
  }
  const games = Math.max(
    positionGames,
    ...firstBuys.values(),
    ...raw.starting.map((r) => r.matchCount),
    ...raw.boots.map((r) => r.matchCount),
    1,
  );
  const total = games;

  // Starting items: hanya yang dibeli sendiri, bukan pemberian teman.
  const bought = raw.starting.filter((r) => !r.wasGiven);
  const firstOf = new Map<number, { matches: number; wins: number }>();
  for (const r of bought) {
    if (r.instance === 0) firstOf.set(r.itemId, { matches: r.matchCount, wins: r.winCount });
  }
  const starting: StartingItem[] = [];
  for (const [itemId, first] of firstOf) {
    if (first.matches / total < MIN_START_SHARE) continue;
    // Jumlah = banyaknya "instance" yang dibeli setidaknya separuh dari yang membeli satu.
    const count =
      1 +
      bought.filter(
        (r) => r.itemId === itemId && r.instance > 0 && r.matchCount >= first.matches / 2,
      ).length;
    starting.push({ itemId, count, matches: first.matches, wins: first.wins });
  }
  starting.sort((a, b) => b.matches - a.matches);

  const boots = raw.boots
    .filter((r) => r.matchCount / total >= MIN_BOOT_SHARE)
    .map((r) => ({
      itemId: r.itemId,
      matches: r.matchCount,
      wins: r.winCount,
      avgTime: Math.round(r.timeAverage),
    }))
    .sort((a, b) => b.matches - a.matches);

  const byItem = new Map<number, TimingPoint[]>();
  for (const r of raw.full) {
    if (r.instance !== 0) continue;
    const list = byItem.get(r.itemId) ?? [];
    list.push([r.time, r.matchCount, r.winCount]);
    byItem.set(r.itemId, list);
  }
  const items: BuildItem[] = [];
  for (const [itemId, points] of byItem) {
    points.sort((a, b) => a[0] - b[0]);
    const matches = points.reduce((s, p) => s + p[1], 0);
    if (matches / total < MIN_ITEM_SHARE) continue;
    const wins = points.reduce((s, p) => s + p[2], 0);
    let seen = 0;
    let medianMinute = points[points.length - 1][0];
    for (const [minute, n] of points) {
      seen += n;
      if (seen >= matches / 2) {
        medianMinute = minute;
        break;
      }
    }
    items.push({
      itemId,
      matches,
      wins,
      medianMinute,
      timing: points.filter((p) => p[1] >= MIN_TIMING_MATCHES),
    });
  }
  items.sort((a, b) => a.medianMinute - b.medianMinute || b.matches - a.matches);

  return { games, starting, boots, items };
}

/** Posisi yang cukup sering dimainkan hero ini (sama dengan filter posisi di draft). */
export function mainPositions(rows: HeroPositionStat[], heroId: number, minShare = 0.1) {
  const mine = rows.filter((r) => r.heroId === heroId);
  const total = mine.reduce((s, r) => s + r.matchCount, 0);
  if (!total) return [];
  return mine
    .filter((r) => r.matchCount / total >= minShare)
    .sort((a, b) => a.position - b.position);
}
