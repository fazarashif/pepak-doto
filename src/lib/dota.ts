// Konstanta dan helper Dota yang aman dipakai di server maupun client.

export const CDN = "https://cdn.cloudflare.steamstatic.com";

export function assetUrl(path?: string | null) {
  if (!path) return "";
  return CDN + path.replace(/\?.*$/, "");
}

export interface HeroInfo {
  id: number;
  name: string; // nama tampilan, mis. "Anti-Mage"
  key: string; // "npc_dota_hero_antimage"
  img: string;
  icon: string;
  roles: string[];
  primaryAttr: "str" | "agi" | "int" | "all";
  attackType: "Melee" | "Ranged";
}

export const BRACKETS = [
  { id: 0, name: "Semua rank" },
  { id: 1, name: "Herald" },
  { id: 2, name: "Guardian" },
  { id: 3, name: "Crusader" },
  { id: 4, name: "Archon" },
  { id: 5, name: "Legend" },
  { id: 6, name: "Ancient" },
  { id: 7, name: "Divine" },
  { id: 8, name: "Immortal" },
] as const;

export const POSITIONS = [
  { id: 0, name: "Semua posisi", short: "Semua" },
  { id: 1, name: "Pos 1 · Carry", short: "Carry" },
  { id: 2, name: "Pos 2 · Mid", short: "Mid" },
  { id: 3, name: "Pos 3 · Offlane", short: "Offlane" },
  { id: 4, name: "Pos 4 · Soft Support", short: "Soft Sup" },
  { id: 5, name: "Pos 5 · Hard Support", short: "Hard Sup" },
] as const;

export const ATTR_LABEL: Record<HeroInfo["primaryAttr"], string> = {
  str: "Strength",
  agi: "Agility",
  int: "Intelligence",
  all: "Universal",
};

export function bracketName(id: number) {
  return BRACKETS.find((b) => b.id === id)?.name ?? "Semua rank";
}

/** rank_tier OpenDota: puluhan = bracket (1 Herald .. 8 Immortal), satuan = bintang. */
export function rankTierLabel(rankTier?: number | null) {
  if (!rankTier) return "Unranked";
  const bracket = Math.floor(rankTier / 10);
  const stars = rankTier % 10;
  const name = bracketName(bracket);
  return bracket === 8 || !stars ? name : `${name} ${stars}`;
}

const STEAM64_OFFSET = BigInt("76561197960265728");

/**
 * Terima Friend ID (32-bit, yang tampil di profil Dota/OpenDota) atau SteamID64,
 * kembalikan account ID 32-bit. Null kalau tidak valid.
 */
export function parseAccountId(input: string): number | null {
  const s = input.trim();
  if (!/^\d{1,20}$/.test(s)) return null;
  const n = BigInt(s);
  if (n > STEAM64_OFFSET) return Number(n - STEAM64_OFFSET);
  if (n > BigInt(0) && n < BigInt(2) ** BigInt(32)) return Number(n);
  return null;
}

export function steamIdToAccountId(steamId64: string): number {
  return Number(BigInt(steamId64) - STEAM64_OFFSET);
}

export function formatClock(seconds: number) {
  const sign = seconds < 0 ? "-" : "";
  const s = Math.abs(Math.round(seconds));
  return `${sign}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function pct(x: number, digits = 1) {
  return `${(x * 100).toFixed(digits)}%`;
}

/** Selisih dalam poin persen dengan tanda, mis. +2.3 */
export function pp(x: number, digits = 1) {
  const v = x * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}`;
}
