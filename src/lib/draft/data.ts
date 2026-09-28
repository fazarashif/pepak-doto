import "server-only";
import type { DraftData, HeroMatchupTable, PositionStat } from "@/lib/draft/engine";
import { getHeroes } from "@/lib/heroes";
import { opendota } from "@/lib/opendota/client";
import { isStratzConfigured, stratz } from "@/lib/stratz/client";

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

async function fromStratz(picked: number[], bracket: number) {
  const [positionRows, tables] = await Promise.all([
    stratz.heroPositions(bracket),
    mapLimit(picked, 4, (id) => stratz.heroMatchups(id, bracket)),
  ]);

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
  tables.forEach((t, i) => {
    matchups.set(picked[i], {
      with: new Map(
        t.with.map((p) => [p.heroId2, { synergy: p.synergy, matchCount: p.matchCount }]),
      ),
      vs: new Map(t.vs.map((p) => [p.heroId2, { synergy: p.synergy, matchCount: p.matchCount }])),
    });
  });
  return { positions, matchups };
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
  return { positions, matchups };
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
  let tables: Awaited<ReturnType<typeof fromStratz>>;
  if (isStratzConfigured()) {
    try {
      tables = await fromStratz(picked, bracket);
    } catch (err) {
      console.warn("[draft] STRATZ failed, using OpenDota", err);
      source = "opendota";
      tables = await fromOpenDota(picked, bracket);
    }
  } else {
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
      pool: pool?.ok
        ? new Map(pool.rows.map((r) => [r.hero_id, { games: r.games, wins: r.win }]))
        : undefined,
    },
  };
}
