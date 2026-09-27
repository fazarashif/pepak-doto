// Cache in-memory sederhana dengan TTL + dedup request yang sedang berjalan.
// Disimpan di globalThis supaya tidak hilang saat hot-reload di mode dev.

type Entry = { value: unknown; expires: number };

const g = globalThis as unknown as {
  __d2Cache?: Map<string, Entry>;
  __d2Inflight?: Map<string, Promise<unknown>>;
};
const store = (g.__d2Cache ??= new Map());
const inflight = (g.__d2Inflight ??= new Map());

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;

/**
 * Ambil nilai dari cache, atau jalankan `load` lalu simpan hasilnya.
 * `ttl` boleh berupa fungsi supaya lama cache bisa bergantung pada isi data.
 */
export async function cached<T>(
  key: string,
  ttl: number | ((value: T) => number),
  load: () => Promise<T>,
): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = load()
    .then((value) => {
      const ms = typeof ttl === "function" ? ttl(value) : ttl;
      store.set(key, { value, expires: Date.now() + ms });
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

export function invalidate(key: string) {
  store.delete(key);
}
