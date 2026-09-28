// Pemeriksaan jawaban LLM dan urutan provider. Fungsi murni, supaya bisa dites tanpa API.

/** Barang umum yang boleh disebut walau tidak ada di fakta (ward, smoke, dan sejenisnya). */
export const ALWAYS_ALLOWED = [
  "Observer Ward",
  "Sentry Ward",
  "Smoke of Deceit",
  "Dust of Appearance",
  "Town Portal Scroll",
  "Tango",
  "Clarity",
  "Healing Salve",
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Nama hero atau item (dari `vocabulary`) yang disebut di teks tapi tidak ada di `allowed`.
 * Dicocokkan sebagai kata utuh dan peka huruf besar, jadi "tiny mistakes" tidak dianggap Tiny.
 */
export function unknownNames(text: string, allowed: string[], vocabulary: string[]) {
  const ok = new Set([...allowed, ...ALWAYS_ALLOWED].map((s) => s.toLowerCase()));
  const found = new Set<string>();
  // Nama panjang dulu, supaya "Black King Bar" tidak juga terhitung sebagai nama lain di dalamnya.
  const sorted = [...new Set(vocabulary)]
    .filter((v) => v.length >= 2)
    .sort((a, b) => b.length - a.length);
  let rest = text;
  for (const name of sorted) {
    const re = new RegExp(`(^|[^A-Za-z])${escape(name)}(?![A-Za-z])`, "g");
    if (!re.test(rest)) continue;
    if (!ok.has(name.toLowerCase())) found.add(name);
    rest = rest.replace(re, "$1");
  }
  return [...found];
}

/** Ambil objek JSON dari jawaban model (kadang dibungkus ```json atau diberi kalimat pembuka). */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Semua teks di dalam objek (untuk diperiksa namanya). */
export function allText(value: unknown): string {
  if (typeof value === "string") return value;
  const parts = Array.isArray(value)
    ? value.map(allText)
    : value && typeof value === "object"
      ? Object.values(value).map(allText)
      : [];
  return parts.filter(Boolean).join("\n");
}

export interface ChainEntry<P extends string = string> {
  provider: P;
  model: string;
}

export interface Attempt<P extends string = string> extends ChainEntry<P> {
  ok: boolean;
  error?: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ChainProvider {
  isConfigured(): boolean;
  generate(
    model: string,
    req: { system: string; prompt: string; maxTokens: number },
    signal: AbortSignal,
  ): Promise<{ text: string; inputTokens: number; outputTokens: number }>;
}

/**
 * Coba provider satu per satu sampai ada jawaban yang lolos `accept`.
 * Mengembalikan hasil pertama yang diterima, atau null kalau semuanya gagal.
 */
export async function runChain<P extends string, T>(opts: {
  chain: ChainEntry<P>[];
  providers: Record<P, ChainProvider>;
  request: { system: string; prompt: string; maxTokens: number };
  accept: (text: string) => { value: T } | { error: string };
  timeoutMs: number;
  onAttempt?: (a: Attempt<P>) => void | Promise<void>;
}): Promise<{ value: T; entry: ChainEntry<P> } | null> {
  for (const entry of opts.chain) {
    const provider = opts.providers[entry.provider];
    if (!provider?.isConfigured()) continue;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    let attempt: Attempt<P> = { ...entry, ok: false, inputTokens: 0, outputTokens: 0 };
    try {
      const res = await provider.generate(entry.model, opts.request, controller.signal);
      attempt = { ...attempt, inputTokens: res.inputTokens, outputTokens: res.outputTokens };
      const checked = opts.accept(res.text);
      if ("value" in checked) {
        await opts.onAttempt?.({ ...attempt, ok: true });
        return { value: checked.value, entry };
      }
      attempt.error = checked.error;
    } catch (err) {
      attempt.error = controller.signal.aborted
        ? "Timed out"
        : err instanceof Error
          ? err.message.slice(0, 200)
          : "Failed";
    } finally {
      clearTimeout(timer);
    }
    await opts.onAttempt?.(attempt);
  }
  return null;
}
