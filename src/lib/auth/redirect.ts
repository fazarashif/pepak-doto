/** Hanya izinkan redirect ke path internal, supaya login tidak bisa dipakai untuk open redirect. */
export function safeNextPath(next: string | null | undefined, fallback = "/profile") {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
