import "server-only";
import type { HeroInfo } from "@/lib/dota";
import type { DraftData, HeroMatchupTable, PositionStat } from "@/lib/draft/engine";
import type { VsMatrix } from "@/lib/draft/matrix";
import { getHeroes } from "@/lib/heroes";
import { opendota } from "@/lib/opendota/client";
import { getMatchups, getPositions, getVsMatrix } from "@/lib/hero-data/store";

export type DraftSource = "stratz" | "opendota";

/** Jalankan `fn` untuk tiap item dengan paling banyak `limit` sekaligus (STRATZ membatasi 8/detik). */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Data STRATZ hasil sinkron harian. Null kalau ada yang belum tersedia. */
async function fromStratz(picked: number[], bracket: number) {
  const [positionRows, tables, vsMatrix] = await Promise.all([
    getPositions(bracket),
    mapLimit(picked, 4, (id) => getMatchups(id, bracket)),
    // Tanpa tabel ini saran tetap jalan, hanya musuh yang belum di-pick dianggap netral.
    getVsMatrix(bracket).catch((err): VsMatrix | null => {
      console.warn("[draft] vs matrix failed", err);
      return null;
    }),
  ]);
  if (!positionRows?.length || tables.some((t) => t === null)) return null;

  const positions = new Map<number, PositionStat[]>();
  for (const row of positionRows) {
    const list =
      positions.get(row.heroId) ?? Array.from({ length: 5 }, () => ({ matches: 0, wins: 0 }));
    if (row.position >= 1 && row.position <= 5) {
      list[row.position - 1] = { matches: row.matchCount, wins: row.winCount };
    }
    positions.set(row.heroId, list);
  }

  const matchups = new Map<number, HeroMatchupTable>();
  const toMap = (rows: [number, number, number][]) =>
    new Map(rows.map(([heroId2, matchCount, synergy]) => [heroId2, { synergy, matchCount }]));
  tables.forEach((t, i) => {
    matchups.set(picked[i], { with: toMap(t!.with), vs: toMap(t!.vs) });
  });
  return { positions, matchups, vsMatrix: vsMatrix ?? undefined };
}

/**
 * Cadangan kalau STRATZ tidak tersedia. OpenDota tidak punya data per posisi dan matchup-nya
 * hanya dari match pro, jadi hasilnya lebih kasar dan filter posisi tidak berlaku.
 */
async function fromOpenDota(picked: number[], bracket: number) {
  const [stats, tables] = await Promise.all([
    opendota.heroStats(),
    mapLimit(picked, 4, (id) => opendota.matchups(id)),
  ]);

  // OpenDota tidak punya data Immortal, jadi pakai Divine.
  const brackets = bracket === 0 ? [1, 2, 3, 4, 5, 6, 7] : [Math.min(bracket, 7)];
  const positions = new Map<number, PositionStat[]>();
  for (const h of stats) {
    const matches = brackets.reduce((s, b) => s + (h[`${b}_pick`] ?? 0), 0);
    const wins = brackets.reduce((s, b) => s + (h[`${b}_win`] ?? 0), 0);
    // Tanpa data posisi, kelima posisi diisi sama rata supaya filter posisi tidak membuang hero.
    positions.set(
      h.id,
      Array.from({ length: 5 }, () => ({ matches, wins })),
    );
  }

  const matchups = new Map<number, HeroMatchupTable>();
  tables.forEach((rows, i) => {
    matchups.set(picked[i], {
      with: new Map(),
      vs: new Map(
        rows
          .filter((r) => r.games_played > 0)
          .map((r) => [
            r.hero_id,
            { synergy: (r.wins / r.games_played - 0.5) * 100, matchCount: r.games_played },
          ]),
      ),
    });
  });
  return { positions, matchups, vsMatrix: undefined as VsMatrix | undefined };
}

export async function loadDraftData({
  allies,
  enemies,
  bracket,
  accountId,
}: {
  allies: number[];
  enemies: number[];
  bracket: number;
  accountId?: number | null;
}): Promise<{ data: DraftData; source: DraftSource; poolError: boolean }> {
  const picked = [...new Set([...allies, ...enemies])];

  const [heroes, pool] = await Promise.all([
    getHeroes(),
    accountId
      ? opendota
          .playerHeroes(accountId)
          .then((rows) => ({ ok: true as const, rows }))
          .catch(() => ({ ok: false as const, rows: [] }))
      : Promise.resolve(null),
  ]);

  let source: DraftSource = "stratz";
  let tables = await fromStratz(picked, bracket).catch((err) => {
    console.warn("[draft] STRATZ data failed", err);
    return null;
  });
  if (!tables) {
    source = "opendota";
    tables = await fromOpenDota(picked, bracket);
  }

  return {
    source,
    poolError: pool !== null && !pool.ok,
    data: {
      heroes,
      positions: tables.positions,
      matchups: tables.matchups,
      vsMatrix: tables.vsMatrix,
      pool: pool?.ok
        ? new Map(pool.rows.map((r) => [r.hero_id, { games: r.games, wins: r.win }]))
        : undefined,
    },
  };
}

/**
 * Porsi game tiap hero di posisi 1..5 (semua rank), untuk menebak posisi saat hero ditambahkan
 * ke draft. Kalau data STRATZ belum ada, ditebak kasar dari role hero.
 */
export async function getPositionShares(heroes: HeroInfo[]): Promise<[number, number[]][]> {
  const rows = await getPositions(0).catch(() => null);
  if (rows?.length) {
    const totals = new Map<number, number[]>();
    for (const r of rows) {
      if (r.position < 1 || r.position > 5) continue;
      const list = totals.get(r.heroId) ?? [0, 0, 0, 0, 0];
      list[r.position - 1] = r.matchCount;
      totals.set(r.heroId, list);
    }
    return [...totals].map(([id, list]) => [id, normalizeShares(list)]);
  }
  return heroes.map((h) => [h.id, sharesFromRoles(h.roles)]);
}

function normalizeShares(list: number[]) {
  const total = list.reduce((a, b) => a + b, 0);
  return list.map((n) => (total ? Math.round((n / total) * 1000) / 1000 : 0.2));
}

function sharesFromRoles(roles: string[]) {
  const w = [0.05, 0.05, 0.05, 0.05, 0.05];
  const has = (r: string) => roles.includes(r);
  if (has("Carry")) {
    w[0] += 1;
    w[1] += 0.4;
  }
  if (has("Nuker") && !has("Support")) w[1] += 0.4;
  if (has("Initiator") || has("Durable")) w[2] += 0.7;
  if (has("Support")) {
    w[3] += 1;
    w[4] += 1;
  }
  return normalizeShares(w);
}
