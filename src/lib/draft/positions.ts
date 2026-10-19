// Posisi dan lane. Fungsi murni, dipakai client (menebak posisi saat hero ditambah),
// server (mesin draft) dan script backtest.

/** Porsi game hero di posisi 1..5 (index 0..4), jumlahnya 1. */
export type PositionShares = Map<number, number[]>;

export const ALL_POSITIONS = [1, 2, 3, 4, 5] as const;

/**
 * Lawan satu lane untuk tiap posisi: safe lane (1 dan 5) bertemu offlane musuh (3 dan 4),
 * mid bertemu mid.
 */
export function laneOpponents(position: number): number[] {
  if (position === 1 || position === 5) return [3, 4];
  if (position === 3 || position === 4) return [1, 5];
  if (position === 2) return [2];
  return [];
}

export type Lane = "safe" | "mid" | "off";

export function laneOf(position: number): Lane | null {
  if (position === 1 || position === 5) return "safe";
  if (position === 3 || position === 4) return "off";
  if (position === 2) return "mid";
  return null;
}

/** Ubah statistik posisi (jumlah match per posisi) jadi porsi. */
export function sharesFrom(stats: { matches: number }[]): number[] {
  const total = stats.reduce((s, r) => s + r.matches, 0);
  return total ? stats.map((r) => r.matches / total) : [0.2, 0.2, 0.2, 0.2, 0.2];
}

/** Semua cara menempatkan `items` ke posisi di `slots` (urutan penting). */
function* permutations(slots: number[], count: number, prefix: number[] = []): Generator<number[]> {
  if (prefix.length === count) {
    yield prefix;
    return;
  }
  for (const s of slots) {
    if (!prefix.includes(s)) yield* permutations(slots, count, [...prefix, s]);
  }
}

/**
 * Tebak posisi tiap hero dalam satu tim. Hero di `fixed` tetap di posisinya; sisanya dibagi
 * ke posisi kosong dengan kombinasi yang paling sering terjadi (perkalian porsi posisi).
 * Paling banyak 5 hero, jadi semua kombinasi (maksimal 120) dicoba.
 */
export function assignPositions(
  heroIds: number[],
  shares: PositionShares,
  fixed: Map<number, number> = new Map(),
): Map<number, number> {
  const result = new Map<number, number>();
  const used = new Set<number>();
  for (const id of heroIds) {
    const pos = fixed.get(id);
    if (pos && pos >= 1 && pos <= 5 && !used.has(pos)) {
      result.set(id, pos);
      used.add(pos);
    }
  }
  const free = heroIds.filter((id) => !result.has(id)).slice(0, 5 - used.size);
  const slots = ALL_POSITIONS.filter((p) => !used.has(p));

  let best: number[] | null = null;
  let bestScore = -Infinity;
  for (const perm of permutations(slots, free.length)) {
    let score = 0;
    perm.forEach((pos, i) => {
      const share = shares.get(free[i])?.[pos - 1] ?? 0.2;
      // Porsi 0 tetap boleh (hero tidak biasa di posisi itu), hanya sangat tidak disukai.
      score += Math.log(share + 1e-4);
    });
    if (score > bestScore) {
      bestScore = score;
      best = perm;
    }
  }
  best?.forEach((pos, i) => result.set(free[i], pos));
  return result;
}

/** Posisi kosong yang paling cocok untuk satu hero baru. */
export function bestOpenPosition(heroId: number, open: number[], shares: PositionShares) {
  const s = shares.get(heroId);
  return [...open].sort((a, b) => (s?.[b - 1] ?? 0) - (s?.[a - 1] ?? 0))[0] ?? null;
}
