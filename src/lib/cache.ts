import "server-only";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

// Dua lapis cache:
// 1. Memori per instance (cepat, hilang saat instance serverless mati).
// 2. Tabel `api_cache` di database (awet dan dipakai bersama semua instance).

type Entry = { value: unknown; expires: number };

const g = globalThis as unknown as {
  __d2Cache?: Map<string, Entry>;
  __d2Inflight?: Map<string, Promise<unknown>>;
};
const memory = (g.__d2Cache ??= new Map());
const inflight = (g.__d2Inflight ??= new Map());

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

interface CacheOptions {
  /** Simpan juga ke database. Pakai untuk data yang mahal atau lambat diambil. */
  persist?: boolean;
}

/**
 * Ambil nilai dari cache, atau jalankan `load` lalu simpan hasilnya.
 * `ttl` boleh berupa fungsi supaya lama cache bisa bergantung pada isi data.
 */
export async function cached<T>(
  key: string,
  ttl: number | ((value: T) => number),
  load: () => Promise<T>,
  { persist = false }: CacheOptions = {},
): Promise<T> {
  const hit = memory.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = (async () => {
    if (persist) {
      const stored = await readPersisted<T>(key);
      if (stored) {
        memory.set(key, stored);
        return stored.value;
      }
    }
    const value = await load();
    const ms = typeof ttl === "function" ? ttl(value) : ttl;
    const entry = { value, expires: Date.now() + ms };
    memory.set(key, entry);
    if (persist) await writePersisted(key, entry);
    return value;
  })().finally(() => inflight.delete(key));

  inflight.set(key, promise);
  return promise;
}

export async function invalidate(key: string) {
  memory.delete(key);
  try {
    const db = await getDb();
    await db.delete(schema.apiCache).where(eq(schema.apiCache.key, key));
  } catch (err) {
    console.warn("[cache] invalidate failed", key, err);
  }
}

/** Hapus entri kedaluwarsa. Dipanggil oleh cron harian. */
export async function purgeExpired() {
  const db = await getDb();
  await db.delete(schema.apiCache).where(lt(schema.apiCache.expiresAt, sql`now()`));
}

async function readPersisted<T>(key: string): Promise<{ value: T; expires: number } | null> {
  try {
    const db = await getDb();
    const [row] = await db
      .select({ value: schema.apiCache.value, expiresAt: schema.apiCache.expiresAt })
      .from(schema.apiCache)
      .where(and(eq(schema.apiCache.key, key), gt(schema.apiCache.expiresAt, sql`now()`)))
      .limit(1);
    return row ? { value: row.value as T, expires: row.expiresAt.getTime() } : null;
  } catch (err) {
    // Database bermasalah tidak boleh membuat fitur mati; cukup ambil ulang dari API.
    console.warn("[cache] read failed", key, err);
    return null;
  }
}

async function writePersisted(key: string, entry: Entry) {
  try {
    const db = await getDb();
    const expiresAt = new Date(entry.expires);
    await db
      .insert(schema.apiCache)
      .values({ key, value: entry.value, expiresAt })
      .onConflictDoUpdate({
        target: schema.apiCache.key,
        set: { value: entry.value, expiresAt, updatedAt: sql`now()` },
      });
  } catch (err) {
    console.warn("[cache] write failed", key, err);
  }
}
