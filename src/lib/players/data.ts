import "server-only";
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getHeroes } from "@/lib/heroes";
import { opendota } from "@/lib/opendota/client";
import {
  isCountable,
  replayStatsFrom,
  summarizeMatch,
  type HeroBenchmarks,
  type MatchSummary,
  type ReplayStats,
} from "./summary";

export const TREND_SIZES = [20, 50] as const;
const FETCH_LIMIT = 70; // sedikit lebih banyak supaya tetap 50 setelah Turbo/abandon dibuang
const PARSE_PER_DAY = 10;
const REPLAY_PER_RUN = 10;

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function benchmarksFor(heroIds: number[]) {
  const unique = [...new Set(heroIds)];
  const list = await mapLimit(unique, 5, (id) =>
    opendota.benchmarks(id).catch((err) => {
      console.warn("[players] benchmarks failed", id, err);
      return null;
    }),
  );
  return new Map<number, HeroBenchmarks | null>(unique.map((id, i) => [id, list[i]]));
}

export type PlayerLookup =
  | {
      status: "ok";
      accountId: number;
      name: string;
      avatar: string | null;
      rankTier: number | null;
      /** Akun ini terdaftar di Pepak Doto (data disimpan, parse otomatis). */
      registered: boolean;
      summaries: MatchSummary[];
    }
  | { status: "private"; accountId: number; name: string | null }
  | { status: "not-found" }
  | { status: "error"; message: string };

/** Data profil pemain: ringkasan match terakhir beserta persentilnya. */
export async function loadPlayer(accountId: number, limit = 50): Promise<PlayerLookup> {
  let profile;
  let raw;
  try {
    [profile, raw] = await Promise.all([
      opendota.player(accountId),
      opendota.playerMatches(accountId, FETCH_LIMIT),
    ]);
  } catch (err) {
    console.error("[players] lookup failed", accountId, err);
    return { status: "error", message: "OpenDota didn't answer. Try again in a minute." };
  }
  if (!profile.profile) return { status: "not-found" };
  const name = profile.profile.personaname ?? `Player ${accountId}`;
  const countable = raw.filter(isCountable).slice(0, limit);
  if (!countable.length) return { status: "private", accountId, name };

  const bench = await benchmarksFor(countable.map((m) => m.hero_id));
  let summaries = countable.map((m) => summarizeMatch(m, bench.get(m.hero_id) ?? null));

  const registered = await isRegistered(accountId);
  if (registered) {
    try {
      await saveSummaries(accountId, summaries);
      summaries = await withReplayStats(accountId, summaries);
    } catch (err) {
      console.warn("[players] saving summaries failed", accountId, err);
    }
  }

  return {
    status: "ok",
    accountId,
    name,
    avatar: profile.profile.avatarfull ?? null,
    rankTier: profile.rank_tier ?? null,
    registered,
    summaries,
  };
}

async function isRegistered(accountId: number) {
  try {
    const db = await getDb();
    const [row] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.accountId, accountId))
      .limit(1);
    return Boolean(row);
  } catch {
    return false;
  }
}

/** Simpan ringkasan. Statistik replay yang sudah tersimpan tidak ditimpa. */
async function saveSummaries(accountId: number, summaries: MatchSummary[]) {
  if (!summaries.length) return;
  const db = await getDb();
  const t = schema.matchSummaries;
  for (let i = 0; i < summaries.length; i += 50) {
    const rows = summaries.slice(i, i + 50).map((s) => ({
      accountId,
      matchId: s.matchId,
      startTime: new Date(s.startTime * 1000),
      heroId: s.heroId,
      parsed: s.parsed,
      data: s,
    }));
    await db
      .insert(t)
      .values(rows)
      .onConflictDoUpdate({
        target: [t.accountId, t.matchId],
        set: {
          data: sql`jsonb_set(excluded.data, '{replay}', coalesce(${t.data}->'replay', 'null'::jsonb))`,
          parsed: sql`${t.parsed} or excluded.parsed`,
          updatedAt: sql`now()`,
        },
      });
  }
}

async function withReplayStats(accountId: number, summaries: MatchSummary[]) {
  const db = await getDb();
  const t = schema.matchSummaries;
  const rows = await db
    .select({ matchId: t.matchId, data: t.data })
    .from(t)
    .where(
      and(
        eq(t.accountId, accountId),
        inArray(
          t.matchId,
          summaries.map((s) => s.matchId),
        ),
      ),
    );
  const replay = new Map(
    rows.map((r) => [r.matchId, (r.data as MatchSummary).replay as ReplayStats | null]),
  );
  return summaries.map((s) => ({ ...s, replay: replay.get(s.matchId) ?? s.replay }));
}

/** Semua ringkasan tersimpan sejak waktu tertentu (untuk target latihan). */
export async function storedSummaries(accountId: number, since: Date) {
  const db = await getDb();
  const t = schema.matchSummaries;
  const rows = await db
    .select({ data: t.data })
    .from(t)
    .where(and(eq(t.accountId, accountId), gte(t.startTime, since)))
    .orderBy(desc(t.startTime))
    .limit(500);
  return rows.map((r) => r.data as MatchSummary);
}

export interface SyncResult {
  accountId: number;
  saved: number;
  parseRequested: number;
  replaysRead: number;
}

/**
 * Sinkron harian untuk satu user: simpan match 7 hari terakhir, minta parse yang belum,
 * lalu baca statistik replay dari match yang parse-nya sudah selesai.
 */
export async function syncUserMatches(accountId: number): Promise<SyncResult> {
  const result: SyncResult = { accountId, saved: 0, parseRequested: 0, replaysRead: 0 };
  const raw = (await opendota.playerMatches(accountId, 100, 7)).filter(isCountable);
  const bench = await benchmarksFor(raw.map((m) => m.hero_id));
  const summaries = raw.map((m) => summarizeMatch(m, bench.get(m.hero_id) ?? null));
  await saveSummaries(accountId, summaries);
  result.saved = summaries.length;

  const db = await getDb();
  const t = schema.matchSummaries;
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  // Minta parse untuk match yang belum di-parse dan belum pernah diminta.
  const unparsed = await db
    .select({ matchId: t.matchId })
    .from(t)
    .where(
      and(
        eq(t.accountId, accountId),
        eq(t.parsed, false),
        isNull(t.parseRequestedAt),
        gte(t.startTime, weekAgo),
      ),
    )
    .orderBy(desc(t.startTime))
    .limit(PARSE_PER_DAY);
  for (const { matchId } of unparsed) {
    try {
      await opendota.requestParse(matchId);
      await db
        .update(t)
        .set({ parseRequestedAt: new Date() })
        .where(and(eq(t.accountId, accountId), eq(t.matchId, matchId)));
      result.parseRequested++;
    } catch (err) {
      console.warn("[players] parse request failed", matchId, err);
    }
  }

  result.replaysRead = await readReplays(accountId, REPLAY_PER_RUN);
  return result;
}

/** Ambil statistik replay dari match yang sudah di-parse tapi belum dibaca. */
export async function readReplays(accountId: number, max: number) {
  const db = await getDb();
  const t = schema.matchSummaries;
  // Match yang tadinya belum di-parse bisa saja sudah selesai; cek juga yang sudah diminta.
  const candidates = await db
    .select({ matchId: t.matchId, data: t.data, parsed: t.parsed })
    .from(t)
    .where(
      and(
        eq(t.accountId, accountId),
        eq(t.replayChecked, false),
        sql`(${t.parsed} or ${t.parseRequestedAt} is not null)`,
      ),
    )
    .orderBy(desc(t.startTime))
    .limit(max);
  if (!candidates.length) return 0;

  const heroes = new Map((await getHeroes()).map((h) => [h.id, h.key]));
  let read = 0;
  for (const c of candidates) {
    try {
      const match = await opendota.refreshMatch(c.matchId);
      if (!match.od_data?.has_parsed) continue; // parse belum selesai, coba lagi besok
      const summary = c.data as MatchSummary;
      const replay = replayStatsFrom(match, accountId, heroes.get(summary.heroId) ?? "");
      await db
        .update(t)
        .set({
          parsed: true,
          replayChecked: true,
          data: { ...summary, parsed: true, replay },
          updatedAt: new Date(),
        })
        .where(and(eq(t.accountId, accountId), eq(t.matchId, c.matchId)));
      read++;
    } catch (err) {
      console.warn("[players] reading replay failed", c.matchId, err);
    }
  }
  return read;
}

/** Hapus semua ringkasan match milik akun (dipakai saat user menghapus akunnya). */
export async function deleteSummaries(accountId: number) {
  const db = await getDb();
  await db.delete(schema.matchSummaries).where(eq(schema.matchSummaries.accountId, accountId));
}
