import { allText, unknownNames } from "../check";

/** Nama hero dan item yang dikenal aplikasi, untuk memeriksa jawaban model. */
export interface Vocabulary {
  names: string[];
}

export function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s && s.length <= max ? s : null;
}

/** Tolak jawaban yang menyebut hero atau item di luar fakta. */
export function nameError(value: unknown, allowed: string[], vocab: Vocabulary): string | null {
  const unknown = unknownNames(allText(value), allowed, vocab.names);
  return unknown.length ? `Mentions names not in the facts: ${unknown.join(", ")}` : null;
}

export const STYLE = [
  "Use only the facts in the JSON. Never invent numbers, heroes, items or events.",
  "Only mention heroes and items that appear in the facts.",
  "Write plain, friendly English in the second person. No hype, no filler, no emoji.",
  "Answer with one JSON object and nothing else.",
].join(" ");
