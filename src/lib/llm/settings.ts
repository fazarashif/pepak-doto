import { z } from "zod";
import type { ChainEntry } from "./check";

// Pengaturan LLM yang bisa diubah admin tanpa deploy ulang (tabel app_settings, key "llm").
// Tanpa "server-only" supaya parse/default bisa dites.

export const LLM_SETTINGS_KEY = "llm";
export const PROVIDER_IDS = ["anthropic", "gemini", "openrouter"] as const;

const entrySchema = z.object({
  provider: z.enum(PROVIDER_IDS),
  model: z.string().trim().min(1).max(120),
});

export const settingsSchema = z.object({
  enabled: z.boolean(),
  chain: z.array(entrySchema).max(5),
  perUserPerDay: z.number().int().min(0).max(1000),
  globalPerDay: z.number().int().min(0).max(100_000),
});

export type LlmSettings = z.infer<typeof settingsSchema> & {
  chain: ChainEntry<(typeof PROVIDER_IDS)[number]>[];
};

export const DEFAULT_SETTINGS: LlmSettings = {
  enabled: true,
  chain: [
    { provider: "anthropic", model: "claude-haiku-4-5-20251001" },
    { provider: "gemini", model: "gemini-3.5-flash-lite" },
    { provider: "openrouter", model: "google/gemma-4-31b-it:free" },
  ],
  perUserPerDay: 10,
  globalPerDay: 200,
};

/** Baca pengaturan tersimpan; kalau rusak atau belum ada, pakai default. */
export function parseSettings(raw: unknown): LlmSettings {
  const parsed = settingsSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
