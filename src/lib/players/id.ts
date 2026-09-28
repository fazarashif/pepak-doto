import { parseAccountId } from "@/lib/dota";

/**
 * Baca account ID dari input pengguna: Friend ID, SteamID64, atau link profil OpenDota,
 * Dotabuff, STRATZ, dan Steam (`/profiles/7656...`). Link Steam dengan nama kustom
 * (`/id/nama`) tidak bisa dibaca tanpa Steam Web API, jadi mengembalikan null.
 */
export function parsePlayerInput(input: string): number | null {
  const s = input.trim();
  const fromLink = s.match(
    /(?:opendota\.com|dotabuff\.com|stratz\.com)\/players\/(\d+)|steamcommunity\.com\/profiles\/(\d+)/i,
  );
  if (fromLink) return parseAccountId(fromLink[1] ?? fromLink[2]);
  return parseAccountId(s);
}
