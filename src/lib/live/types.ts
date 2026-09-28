import { parseIdList } from "@/lib/draft/types";
import type { GameState } from "@/lib/items/advisor";

/** State halaman Game Plan, disimpan di URL supaya bisa dibuka dari draft dan dibagikan. */
export interface LiveState {
  /** Hero kawan, tanpa hero sendiri. */
  allies: number[];
  enemies: number[];
  hero: number | null;
  position: number;
  bracket: number;
  state: GameState;
  /** Item yang sudah dimiliki (id). */
  owned: number[];
  /** Menit game sekarang, untuk menyorot fase yang sedang berjalan. */
  minute: number | null;
}

type Params = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function intIn(v: string | undefined, min: number, max: number, fallback: number) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

export function parseLiveState(sp: Params, defaults: { bracket: number; position: number }) {
  const hero = intIn(first(sp.h), 1, 299, 0) || null;
  const enemies = parseIdList(sp.e, 5).filter((id) => id !== hero);
  const allies = parseIdList(sp.a, 4).filter((id) => id !== hero && !enemies.includes(id));
  const s = first(sp.s);
  const minute = first(sp.m);
  return {
    allies,
    enemies,
    hero,
    position: intIn(first(sp.p), 0, 5, defaults.position),
    bracket: intIn(first(sp.r), 0, 8, defaults.bracket),
    state: s === "ahead" || s === "behind" ? s : "even",
    owned: parseIdList(sp.o, 40),
    minute: minute ? intIn(minute, 0, 180, 0) : null,
  } satisfies LiveState;
}

export function liveSearchParams(state: LiveState) {
  const params = new URLSearchParams();
  if (state.hero) params.set("h", String(state.hero));
  if (state.allies.length) params.set("a", state.allies.join(","));
  if (state.enemies.length) params.set("e", state.enemies.join(","));
  params.set("p", String(state.position));
  params.set("r", String(state.bracket));
  if (state.state !== "even") params.set("s", state.state);
  if (state.owned.length) params.set("o", state.owned.join(","));
  if (state.minute !== null) params.set("m", String(state.minute));
  return params;
}
