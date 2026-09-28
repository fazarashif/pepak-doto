// Query STRATZ tanpa ketergantungan ke Next.js, supaya bisa dipakai aplikasi dan
// script sinkron harian (scripts/sync-hero-data.ts).

import type { StratzBracket } from "./brackets";

const ENDPOINT = "https://api.stratz.com/graphql";

export class StratzError extends Error {
  constructor(
    message: string,
    public status: number,
    /** Kapan boleh mencoba lagi, kalau STRATZ menyebutkannya (batas IP atau rate limit). */
    public retryAt: Date | null = null,
  ) {
    super(message);
  }
}

export interface StratzResponseInfo {
  remainingDay: number | null;
  remainingMinute: number | null;
}

export type Gql = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

/** Token STRATZ hanya boleh dipakai dari 2 IP per 15 menit. Pesannya menyebut jam kapan IP bebas lagi. */
function parseRetryAt(text: string): Date | null {
  const m = text.match(/at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) UTC/);
  return m ? new Date(`${m[1].replace(" ", "T")}Z`) : null;
}

export function createGql(token: string, onResponse?: (info: StratzResponseInfo) => void): Gql {
  return async <T>(query: string, variables: Record<string, unknown> = {}) => {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        // STRATZ menolak request tanpa User-Agent ini
        "User-Agent": "STRATZ_API",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    const header = (name: string) => {
      const v = res.headers.get(name);
      return v === null ? null : Number(v);
    };
    onResponse?.({
      remainingDay: header("x-ratelimit-remaining-day"),
      remainingMinute: header("x-ratelimit-remaining-minute"),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new StratzError(
        `STRATZ ${res.status}: ${text.slice(0, 200)}`,
        res.status,
        parseRetryAt(text),
      );
    }
    let body: { data?: T; errors?: { message: string }[] };
    try {
      body = JSON.parse(text);
    } catch {
      // Batas IP kadang dikirim sebagai teks biasa dengan status 200.
      throw new StratzError(`STRATZ: ${text.slice(0, 200)}`, res.status, parseRetryAt(text));
    }
    if (body.errors?.length) throw new StratzError(body.errors[0].message, res.status);
    return body.data as T;
  };
}

const bracketArg = (b: StratzBracket) => (b === "ALL" ? "null" : `[${b}]`);

// ---------------------------------------------------------------------------
// Matchup

/** Satu pasangan hero: [heroId2, matchCount, synergy]. Synergy dalam poin persen. */
export type PairRow = [heroId2: number, matchCount: number, synergy: number];

export interface HeroMatchups {
  with: PairRow[];
  vs: PairRow[];
}

interface RawPair {
  heroId2: number;
  matchCount: number;
  synergy: number;
}

/** Synergy dan keunggulan beberapa hero sekaligus (satu request, pakai alias). */
export async function fetchMatchups(
  gql: Gql,
  heroIds: number[],
  bracket: StratzBracket,
): Promise<Map<number, HeroMatchups>> {
  const fields = heroIds
    .map(
      (
        id,
      ) => `h${id}: heroVsHeroMatchup(heroId: ${id}, bracketBasicIds: ${bracketArg(bracket)}, take: 200) {
        advantage { with { heroId2 matchCount synergy } vs { heroId2 matchCount synergy } }
      }`,
    )
    .join("\n");
  const data = await gql<{
    heroStats: Record<string, { advantage: { with: RawPair[]; vs: RawPair[] }[] } | null>;
  }>(`{ heroStats { ${fields} } }`);

  const pack = (rows: RawPair[]): PairRow[] =>
    rows.map((r) => [r.heroId2, r.matchCount, Math.round(r.synergy * 1000) / 1000]);
  const out = new Map<number, HeroMatchups>();
  for (const id of heroIds) {
    const row = data.heroStats[`h${id}`]?.advantage[0];
    out.set(id, { with: pack(row?.with ?? []), vs: pack(row?.vs ?? []) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Posisi

export interface HeroPositionStat {
  heroId: number;
  position: number;
  matchCount: number;
  winCount: number;
}

/** Jumlah match dan kemenangan tiap hero per posisi (1..5) di satu bracket. */
export async function fetchPositions(gql: Gql, bracket: StratzBracket) {
  const data = await gql<{
    heroStats: {
      stats: { heroId: number; position: string; matchCount: number; winCount: number }[] | null;
    };
  }>(`{ heroStats { stats(bracketBasicIds: ${bracketArg(bracket)}, groupByPosition: true) {
    heroId position matchCount winCount
  } } }`);
  return (data.heroStats.stats ?? []).map((r): HeroPositionStat => ({
    heroId: r.heroId,
    position: Number(r.position.replace("POSITION_", "")),
    matchCount: r.matchCount,
    winCount: r.winCount,
  }));
}

// ---------------------------------------------------------------------------
// Profil hero: rata-rata per match, dipakai untuk komposisi damage musuh

export interface HeroProfile {
  heroId: number;
  matchCount: number;
  physicalDamage: number;
  magicalDamage: number;
  pureDamage: number;
  stunDuration: number;
  disableDuration: number;
  healingSelf: number;
  healingAllies: number;
  invisibleCount: number;
}

export async function fetchHeroProfiles(gql: Gql, bracket: StratzBracket) {
  const data = await gql<{ heroStats: { stats: HeroProfile[] | null } }>(`{ heroStats {
    stats(bracketBasicIds: ${bracketArg(bracket)}) {
      heroId matchCount physicalDamage magicalDamage pureDamage stunDuration disableDuration
      healingSelf healingAllies invisibleCount
    }
  } }`);
  const round = (n: number) => Math.round(n);
  return (data.heroStats.stats ?? []).map((r): HeroProfile => ({
    heroId: r.heroId,
    matchCount: r.matchCount,
    physicalDamage: round(r.physicalDamage),
    magicalDamage: round(r.magicalDamage),
    pureDamage: round(r.pureDamage),
    stunDuration: round(r.stunDuration),
    disableDuration: round(r.disableDuration),
    healingSelf: round(r.healingSelf),
    healingAllies: round(r.healingAllies),
    invisibleCount: round(r.invisibleCount),
  }));
}

// ---------------------------------------------------------------------------
// Build item per hero per posisi

export interface RawFullPurchase {
  itemId: number;
  time: number; // menit
  instance: number; // 0 = pembelian pertama
  matchCount: number;
  winCount: number;
}

export interface RawStartingPurchase {
  itemId: number;
  instance: number; // 0 = item pertama jenis ini, 1 = kedua, dst.
  wasGiven: boolean;
  matchCount: number;
  winCount: number;
}

export interface RawBootPurchase {
  itemId: number;
  matchCount: number;
  winCount: number;
  timeAverage: number; // detik
}

export interface RawHeroItems {
  full: RawFullPurchase[];
  starting: RawStartingPurchase[];
  boots: RawBootPurchase[];
}

export interface HeroPositionKey {
  heroId: number;
  position: number;
}

/** Data pembelian item untuk beberapa pasangan hero + posisi sekaligus. */
export async function fetchItems(
  gql: Gql,
  combos: HeroPositionKey[],
  bracket: StratzBracket,
): Promise<RawHeroItems[]> {
  const b = bracketArg(bracket);
  const fields = combos
    .map(({ heroId, position }, i) => {
      const args = `heroId: ${heroId}, bracketBasicIds: ${b}, positionIds: [POSITION_${position}]`;
      return `
      f${i}: itemFullPurchase(${args}) { itemId time instance matchCount winCount }
      s${i}: itemStartingPurchase(${args}) { itemId instance wasGiven matchCount winCount }
      b${i}: itemBootPurchase(${args}) { itemId matchCount winCount timeAverage }`;
    })
    .join("\n");
  const data = await gql<{ heroStats: Record<string, unknown[] | null> }>(
    `{ heroStats { ${fields} } }`,
  );
  return combos.map((_, i) => ({
    full: (data.heroStats[`f${i}`] ?? []) as RawFullPurchase[],
    starting: (data.heroStats[`s${i}`] ?? []) as RawStartingPurchase[],
    boots: (data.heroStats[`b${i}`] ?? []) as RawBootPurchase[],
  }));
}
