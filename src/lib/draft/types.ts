import type { DraftResult, DraftRound, DraftSlot } from "./engine";

export interface DraftRequest {
  allies: DraftSlot[];
  enemies: DraftSlot[];
  bans: number[];
  bracket: number;
  position: number;
  round: DraftRound;
  poolOnly: boolean;
}

export interface DraftResponse extends DraftResult {
  source: "stratz" | "opendota";
  bracketLabel: string;
  /** Status hero pool: user belum login, berhasil dimuat, atau gagal (biasanya profil privat). */
  pool: "signed-out" | "ok" | "error";
}

/** State draft di halaman, disimpan di URL supaya bisa di-refresh dan dibagikan. */
export interface DraftState {
  /** Hero tim sendiri per posisi: index 0..4 untuk posisi 1..5, 0 berarti kosong. */
  allies: number[];
  /** Hero musuh, urut sesuai saat ditambahkan. */
  enemies: number[];
  /** Sejajar dengan `enemies`: posisi yang diisi user, 0 berarti ditebak otomatis. */
  enemyPos: number[];
  bans: number[];
  bracket: number;
  /** Posisi user, 0 kalau tidak diisi. */
  position: number;
  round: DraftRound;
  poolOnly: boolean;
}

export const EMPTY_TEAM = [0, 0, 0, 0, 0];

const validHero = (n: number) => Number.isInteger(n) && n > 0 && n < 300;
const validPos = (n: number) => Number.isInteger(n) && n >= 1 && n <= 5;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseIdList(value: string | string[] | undefined, max: number) {
  const raw = first(value);
  if (!raw) return [];
  const ids = raw
    .split(",")
    .map((s) => Number(s))
    .filter(validHero);
  return [...new Set(ids)].slice(0, max);
}

/**
 * Daftar `hero` atau `hero:posisi`, mis. "14,8:3". Posisi 0 kalau tidak ditulis.
 * Hero dan posisi yang dobel dibuang (posisinya saja yang dikosongkan).
 */
export function parseSlotList(value: string | string[] | undefined, max: number) {
  const raw = first(value);
  const out: { heroId: number; position: number }[] = [];
  if (!raw) return out;
  for (const part of raw.split(",")) {
    const [h, p] = part.split(":").map(Number);
    if (!validHero(h) || out.some((s) => s.heroId === h)) continue;
    const position = validPos(p) && !out.some((s) => s.position === p) ? p : 0;
    out.push({ heroId: h, position });
    if (out.length >= max) break;
  }
  return out;
}

export function parseRound(value: string | string[] | undefined): DraftRound {
  const n = Number(first(value));
  return n === 2 || n === 3 ? n : 1;
}

const slotList = (slots: { heroId: number; position: number }[]) =>
  slots.map((s) => (s.position ? `${s.heroId}:${s.position}` : String(s.heroId))).join(",");

export function toSearchParams(state: DraftState) {
  const params = new URLSearchParams();
  const allies = state.allies
    .map((heroId, i) => ({ heroId, position: i + 1 }))
    .filter((s) => s.heroId);
  if (allies.length) params.set("a", slotList(allies));
  if (state.enemies.length) {
    params.set(
      "e",
      slotList(state.enemies.map((heroId, i) => ({ heroId, position: state.enemyPos[i] ?? 0 }))),
    );
  }
  if (state.bans.length) params.set("b", state.bans.join(","));
  params.set("r", String(state.bracket));
  params.set("p", String(state.position));
  params.set("rd", String(state.round));
  if (state.poolOnly) params.set("pool", "1");
  return params;
}

/** Hero tim sendiri sebagai slot (posisi terisi saja). */
export function allySlots(allies: number[]): DraftSlot[] {
  return allies.map((heroId, i) => ({ heroId, position: i + 1 })).filter((s) => s.heroId > 0);
}
