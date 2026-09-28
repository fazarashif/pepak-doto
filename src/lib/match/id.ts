/** Ambil match ID dari angka biasa atau dari link OpenDota, Dotabuff, atau STRATZ. */
export function parseMatchId(input: string): number | null {
  const s = input.trim();
  const fromUrl = /\/matches?\/(\d{6,12})/.exec(s)?.[1];
  const digits = fromUrl ?? (/^\d{6,12}$/.test(s) ? s : null);
  return digits ? Number(digits) : null;
}
