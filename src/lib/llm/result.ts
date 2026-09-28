// Bentuk hasil server action narasi, dipakai bersama oleh server dan komponen client.

export type CoachResult<T> =
  | {
      ok: true;
      content: T;
      /** Siapa yang menulis, mis. "Claude Haiku 4.5", atau null untuk teks template. */
      by: string | null;
      /** Penjelasan kalau yang tampil adalah versi template. */
      note: string | null;
    }
  | { ok: false; message: string };

const MODEL_LABELS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "claude-sonnet-5": "Claude Sonnet 5",
};

export function modelLabel(model: string) {
  return MODEL_LABELS[model] ?? model;
}

export const TEMPLATE_NOTE = {
  disabled: "Coaching notes are turned off right now, so here's the plain version.",
  "user-limit":
    "You've used today's coaching notes, so here's the plain version. Try again tomorrow.",
  "global-limit":
    "Pepak Doto has reached today's limit for coaching notes, so here's the plain version.",
  "no-provider": "The coach isn't set up yet, so here's the plain version.",
  failed: "The coach couldn't answer right now, so here's the plain version. Try again later.",
} as const;
