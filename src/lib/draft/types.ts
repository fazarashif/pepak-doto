import type { DraftResult } from "./engine";

export interface DraftRequest {
  allies: number[];
  enemies: number[];
  bans: number[];
  bracket: number;
  position: number;
  poolOnly: boolean;
}

export interface DraftResponse extends DraftResult {
  source: "stratz" | "opendota";
  bracketLabel: string;
  /** Status hero pool: user belum login, berhasil dimuat, atau gagal (biasanya profil privat). */
  pool: "signed-out" | "ok" | "error";
}

/** State draft yang disimpan di URL supaya bisa di-refresh dan dibagikan. */
export type DraftState = DraftRequest;

export function parseIdList(value: string | string[] | undefined, max: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n > 0 && n < 300);
  return [...new Set(ids)].slice(0, max);
}

export function toSearchParams(state: DraftState) {
  const params = new URLSearchParams();
  if (state.allies.length) params.set("a", state.allies.join(","));
  if (state.enemies.length) params.set("e", state.enemies.join(","));
  if (state.bans.length) params.set("b", state.bans.join(","));
  params.set("r", String(state.bracket));
  params.set("p", String(state.position));
  if (state.poolOnly) params.set("pool", "1");
  return params;
}
