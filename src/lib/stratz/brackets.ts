// STRATZ mengelompokkan rank berpasangan. Bracket aplikasi: 0 = semua, 1 Herald .. 8 Immortal.

export type StratzBracket =
  "HERALD_GUARDIAN" | "CRUSADER_ARCHON" | "LEGEND_ANCIENT" | "DIVINE_IMMORTAL" | "ALL";

export function toStratzBracket(bracket: number): StratzBracket {
  if (bracket === 1 || bracket === 2) return "HERALD_GUARDIAN";
  if (bracket === 3 || bracket === 4) return "CRUSADER_ARCHON";
  if (bracket === 5 || bracket === 6) return "LEGEND_ANCIENT";
  if (bracket === 7 || bracket === 8) return "DIVINE_IMMORTAL";
  return "ALL";
}
