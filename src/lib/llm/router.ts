import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { extractJson, runChain, type ChainEntry } from "./check";
import { estimateCost, PROVIDERS, type ProviderId } from "./providers";
import { DEFAULT_SETTINGS, LLM_SETTINGS_KEY, parseSettings, type LlmSettings } from "./settings";

export type NarrativeKind = "match" | "trends" | "hero";

const TIMEOUT_MS = 25_000;

export interface NarrativeSpec<T> {
  kind: NarrativeKind;
  key: string;
  version: number;
  system: string;
  prompt: string;
  maxTokens: number;
  /** Ubah JSON dari model jadi hasil bertipe, atau kembalikan pesan error. */
  parse: (json: unknown) => { value: T } | { error: string };
  /** Teks cadangan kalau semua model gagal atau fitur dimatikan. */
  template: () => T;
}

export type NarrativeResult<T> =
  | { source: "cache" | "llm"; content: T; provider: string; model: string }
  | {
      source: "template";
      content: T;
      /** Kenapa template yang dipakai. */
      reason: "disabled" | "user-limit" | "global-limit" | "no-provider" | "failed";
    };

export async function getLlmSettings(): Promise<LlmSettings> {
  try {
    const db = await getDb();
    const [row] = await db
      .select({ value: schema.appSettings.value })
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, LLM_SETTINGS_KEY))
      .limit(1);
    return row ? parseSettings(row.value) : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveLlmSettings(settings: LlmSettings, userId: string) {
  const db = await getDb();
  await db
    .insert(schema.appSettings)
    .values({ key: LLM_SETTINGS_KEY, value: settings, updatedBy: userId })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: { value: settings, updatedBy: userId, updatedAt: sql`now()` },
    });
}

export async function getStoredNarrative<T>(kind: NarrativeKind, key: string, version: number) {
  try {
    const db = await getDb();
    const t = schema.narratives;
    const [row] = await db
      .select({ content: t.content, provider: t.provider, model: t.model })
      .from(t)
      .where(and(eq(t.kind, kind), eq(t.key, key), eq(t.version, version)))
      .limit(1);
    return row ? { content: row.content as T, provider: row.provider, model: row.model } : null;
  } catch (err) {
    console.warn("[llm] reading narrative failed", kind, key, err);
    return null;
  }
}

const startOfDay = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

async function usedToday(userId: string | null) {
  const db = await getDb();
  const t = schema.narratives;
  const since = startOfDay();
  const [all] = await db.select({ n: count() }).from(t).where(gte(t.createdAt, since));
  let mine = 0;
  if (userId) {
    const [row] = await db
      .select({ n: count() })
      .from(t)
      .where(and(eq(t.createdBy, userId), gte(t.createdAt, since)));
    mine = row.n;
  }
  return { mine, all: all.n };
}

async function recordUsage(
  feature: NarrativeKind,
  a: {
    provider: ProviderId;
    model: string;
    ok: boolean;
    error?: string;
    inputTokens: number;
    outputTokens: number;
  },
) {
  try {
    const db = await getDb();
    const t = schema.llmUsage;
    const cost = estimateCost(a.provider, a.model, a.inputTokens, a.outputTokens);
    const day = new Date().toISOString().slice(0, 10);
    await db
      .insert(t)
      .values({
        day,
        provider: a.provider,
        model: a.model,
        feature,
        requests: 1,
        failures: a.ok ? 0 : 1,
        inputTokens: a.inputTokens,
        outputTokens: a.outputTokens,
        costUsd: cost,
        lastError: a.error ?? null,
      })
      .onConflictDoUpdate({
        target: [t.day, t.provider, t.model, t.feature],
        set: {
          requests: sql`${t.requests} + 1`,
          failures: sql`${t.failures} + ${a.ok ? 0 : 1}`,
          inputTokens: sql`${t.inputTokens} + ${a.inputTokens}`,
          outputTokens: sql`${t.outputTokens} + ${a.outputTokens}`,
          costUsd: sql`${t.costUsd} + ${cost}`,
          lastError: a.error ? a.error : sql`${t.lastError}`,
          updatedAt: sql`now()`,
        },
      });
  } catch (err) {
    console.warn("[llm] recording usage failed", err);
  }
}

/**
 * Ambil narasi dari cache, atau buat baru lewat urutan model di pengaturan admin.
 * Narasi baru dihitung ke batas harian user dan total. Kalau semuanya gagal, dipakai template.
 */
export async function generateNarrative<T>(
  spec: NarrativeSpec<T>,
  userId: string,
): Promise<NarrativeResult<T>> {
  const cached = await getStoredNarrative<T>(spec.kind, spec.key, spec.version);
  if (cached) return { source: "cache", ...cached };

  const settings = await getLlmSettings();
  const template = (reason: Extract<NarrativeResult<T>, { source: "template" }>["reason"]) =>
    ({ source: "template", content: spec.template(), reason }) as const;
  if (!settings.enabled) return template("disabled");

  const used = await usedToday(userId);
  if (used.mine >= settings.perUserPerDay) return template("user-limit");
  if (used.all >= settings.globalPerDay) return template("global-limit");

  const chain = settings.chain.filter((c) => PROVIDERS[c.provider]?.isConfigured());
  if (!chain.length) return template("no-provider");

  const result = await runChain({
    chain,
    providers: PROVIDERS,
    request: { system: spec.system, prompt: spec.prompt, maxTokens: spec.maxTokens },
    timeoutMs: TIMEOUT_MS,
    accept: (text) => {
      const json = extractJson(text);
      if (!json) return { error: "Answer was not JSON" };
      return spec.parse(json);
    },
    onAttempt: (a) => recordUsage(spec.kind, a),
  });
  if (!result) return template("failed");

  try {
    const db = await getDb();
    await db
      .insert(schema.narratives)
      .values({
        kind: spec.kind,
        key: spec.key,
        version: spec.version,
        content: result.value,
        provider: result.entry.provider,
        model: result.entry.model,
        createdBy: userId,
      })
      .onConflictDoNothing();
  } catch (err) {
    console.warn("[llm] saving narrative failed", err);
  }
  return {
    source: "llm",
    content: result.value,
    provider: result.entry.provider,
    model: result.entry.model,
  };
}

/** Coba satu provider + model dengan prompt kecil (tombol Test di admin). */
export async function testModel(entry: ChainEntry<ProviderId>) {
  const provider = PROVIDERS[entry.provider];
  if (!provider.isConfigured()) {
    return { ok: false, message: `${provider.envVar} is not set.` };
  }
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await provider.generate(
      entry.model,
      {
        system: "Answer with a JSON object only.",
        prompt: 'Return {"ok": true, "hero": "Pudge"}.',
        maxTokens: 50,
      },
      controller.signal,
    );
    const json = extractJson(res.text);
    return {
      ok: Boolean(json),
      message: `${Date.now() - started} ms, ${res.inputTokens} in / ${res.outputTokens} out: ${res.text.slice(0, 120)}`,
    };
  } catch (err) {
    return {
      ok: false,
      message: controller.signal.aborted
        ? "Timed out"
        : err instanceof Error
          ? err.message
          : "Failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function llmUsageReport(days = 7) {
  const db = await getDb();
  const t = schema.llmUsage;
  return db
    .select()
    .from(t)
    .where(sql`${t.day} >= current_date - ${days}::int`)
    .orderBy(desc(t.day), t.provider, t.feature);
}

/** Jumlah narasi yang dibuat hari ini (untuk panel admin). */
export async function narrativesToday() {
  return (await usedToday(null)).all;
}
