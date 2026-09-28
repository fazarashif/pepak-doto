import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Provider LLM. Masing-masing hanya aktif kalau API key-nya ada di environment variable.
// Model bisa diganti admin (termasuk model yang tidak ada di daftar), jadi daftar di sini
// hanya pilihan cepat beserta harga untuk perkiraan biaya.

export type ProviderId = "anthropic" | "gemini" | "openrouter";

export interface ModelInfo {
  id: string;
  label: string;
  /** USD per 1 juta token. Null kalau tidak diketahui; 0 untuk model gratis. */
  inputPrice: number | null;
  outputPrice: number | null;
}

export interface LlmRequest {
  system: string;
  prompt: string;
  maxTokens: number;
}

export interface LlmResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LlmProvider {
  id: ProviderId;
  label: string;
  envVar: string;
  models: ModelInfo[];
  isConfigured(): boolean;
  generate(model: string, req: LlmRequest, signal: AbortSignal): Promise<LlmResult>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    public retryable = true,
  ) {
    super(message);
  }
}

// Harga dicek 2026-09-28 (OpenRouter memakai harga yang sama dengan Anthropic).
const anthropicProvider: LlmProvider = {
  id: "anthropic",
  label: "Anthropic (Claude)",
  envVar: "ANTHROPIC_API_KEY",
  models: [
    { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", inputPrice: 1, outputPrice: 5 },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5", inputPrice: 2, outputPrice: 10 },
  ],
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),
  async generate(model, req, signal) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 0 });
    const res = await client.messages.create(
      {
        model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      },
      { signal },
    );
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return { text, inputTokens: res.usage.input_tokens, outputTokens: res.usage.output_tokens };
  },
};

const geminiProvider: LlmProvider = {
  id: "gemini",
  label: "Google Gemini (free tier)",
  envVar: "GEMINI_API_KEY",
  models: [
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", inputPrice: 0, outputPrice: 0 },
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash", inputPrice: 0, outputPrice: 0 },
  ],
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),
  async generate(model, req, signal) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: "user", parts: [{ text: req.prompt }] }],
        generationConfig: { maxOutputTokens: req.maxTokens, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) {
      throw new LlmError(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    return {
      text,
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
    };
  },
};

const openRouterProvider: LlmProvider = {
  id: "openrouter",
  label: "OpenRouter (free models)",
  envVar: "OPENROUTER_API_KEY",
  models: [
    {
      id: "google/gemma-4-31b-it:free",
      label: "Gemma 4 31B (free)",
      inputPrice: 0,
      outputPrice: 0,
    },
    { id: "qwen/qwen3.8-27b:free", label: "Qwen 3.8 27B (free)", inputPrice: 0, outputPrice: 0 },
  ],
  isConfigured: () => Boolean(process.env.OPENROUTER_API_KEY),
  async generate(model, req, signal) {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "X-Title": "Pepak Doto",
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens,
        messages: [
          { role: "system", content: req.system },
          { role: "user", content: req.prompt },
        ],
      }),
    });
    if (!res.ok) {
      throw new LlmError(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: body.choices?.[0]?.message?.content ?? "",
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  },
};

export const PROVIDERS: Record<ProviderId, LlmProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openrouter: openRouterProvider,
};

export function isProviderId(v: string): v is ProviderId {
  return Object.hasOwn(PROVIDERS, v);
}

/** Perkiraan biaya (USD). Model yang tidak dikenal dianggap berbayar dengan harga tidak diketahui (0). */
export function estimateCost(provider: ProviderId, model: string, input: number, output: number) {
  const info = PROVIDERS[provider].models.find((m) => m.id === model);
  if (!info || info.inputPrice === null || info.outputPrice === null) return 0;
  return (input * info.inputPrice + output * info.outputPrice) / 1_000_000;
}
