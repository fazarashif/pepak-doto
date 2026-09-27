// Steam memakai OpenID 2.0. Alurnya:
// 1. Arahkan user ke Steam dengan `buildLoginUrl`.
// 2. Steam mengembalikan user ke `return_to` dengan parameter `openid.*`.
// 3. `checkAssertion` memvalidasi parameter itu, lalu `verifyWithSteam` meminta Steam
//    mengonfirmasi tanda tangannya (mode check_authentication).

export const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const NS = "http://specs.openid.net/auth/2.0";
const IDENTIFIER_SELECT = "http://specs.openid.net/auth/2.0/identifier_select";
const CLAIMED_ID_RE = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

export function buildLoginUrl(returnTo: string, realm: string) {
  const params = new URLSearchParams({
    "openid.ns": NS,
    "openid.mode": "checkid_setup",
    "openid.return_to": returnTo,
    "openid.realm": realm,
    "openid.identity": IDENTIFIER_SELECT,
    "openid.claimed_id": IDENTIFIER_SELECT,
  });
  return `${STEAM_OPENID_ENDPOINT}?${params}`;
}

export type AssertionResult = { ok: true; steamId: string } | { ok: false; reason: string };

/**
 * Pemeriksaan lokal sebelum bertanya ke Steam. `expectedReturnTo` adalah URL callback
 * yang kita kirim di langkah 1 (tanpa parameter openid.*).
 */
export function checkAssertion(params: URLSearchParams, expectedReturnTo: string): AssertionResult {
  if (params.get("openid.mode") !== "id_res") return { ok: false, reason: "mode" };
  if (params.get("openid.ns") !== NS) return { ok: false, reason: "ns" };
  if (params.get("openid.op_endpoint") !== STEAM_OPENID_ENDPOINT) {
    return { ok: false, reason: "op_endpoint" };
  }
  if (params.get("openid.return_to") !== expectedReturnTo) {
    return { ok: false, reason: "return_to" };
  }

  const claimed = params.get("openid.claimed_id") ?? "";
  const match = CLAIMED_ID_RE.exec(claimed);
  if (!match || params.get("openid.identity") !== claimed) {
    return { ok: false, reason: "claimed_id" };
  }

  // Field yang ditandatangani Steam harus mencakup semua field penting di atas.
  const signed = new Set((params.get("openid.signed") ?? "").split(","));
  for (const field of ["op_endpoint", "claimed_id", "identity", "return_to", "response_nonce"]) {
    if (!signed.has(field)) return { ok: false, reason: `unsigned:${field}` };
  }

  return { ok: true, steamId: match[1] };
}

/** Minta Steam memverifikasi tanda tangan. Steam juga menolak nonce yang sudah pernah dipakai. */
export async function verifyWithSteam(
  params: URLSearchParams,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const body = new URLSearchParams();
  for (const [key, value] of params) {
    if (key.startsWith("openid.")) body.set(key, value);
  }
  body.set("openid.mode", "check_authentication");

  const res = await fetchImpl(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) return false;
  const text = await res.text();
  return /^is_valid\s*:\s*true\s*$/m.test(text);
}
