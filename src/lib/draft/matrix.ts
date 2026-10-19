// Tabel keunggulan semua hero melawan semua hero dalam satu bracket. Dipakai untuk menilai
// hero melawan musuh yang belum di-pick (ronde 1 dan 2 di Ranked All Pick).
// Tanpa ketergantungan ke Next.js, supaya bisa dipakai script sinkron dan backtest.

import type { PairRow } from "@/lib/stratz/api";

/** Semakin kecil sampel, semakin nilai ditarik ke nol. Sama dengan mesin draft. */
export const PAIR_SHRINK = 300;

export function shrink(synergy: number, matchCount: number) {
  return synergy * (matchCount / (matchCount + PAIR_SHRINK));
}

/**
 * `matrix[a][b]`: keunggulan hero a melawan hero b dalam poin persen (sudah dikecilkan
 * untuk sampel kecil). Diambil dari tabel `vs` milik b dengan tanda dibalik, sama seperti
 * cara mesin draft menghitung counter terhadap musuh yang sudah terlihat.
 */
export type VsMatrix = Record<number, Record<number, number>>;

export function buildVsMatrix(tables: Iterable<[heroId: number, vs: PairRow[]]>): VsMatrix {
  const matrix: VsMatrix = {};
  for (const [enemyId, rows] of tables) {
    for (const [heroId, matchCount, synergy] of rows) {
      if (heroId === enemyId) continue;
      (matrix[heroId] ??= {})[enemyId] = Math.round(-shrink(synergy, matchCount) * 100) / 100;
    }
  }
  return matrix;
}

export function matrixSize(matrix: VsMatrix) {
  return Object.keys(matrix).length;
}
