// Saran item untuk Game Plan: build inti per fase dan item situasional melawan musuh.
// Fungsi murni; datanya disiapkan src/lib/live/data.ts.

import type { BuildItem, ItemBuild } from "@/lib/hero-data/types";
import type { HeroProfile } from "@/lib/stratz/api";
import { TRAIT_PHRASE, type HeroTrait, type HeroTraitsFile } from "./traits";

export type Role = "core" | "offlane" | "support";
export type GameState = "ahead" | "even" | "behind";
export type Phase = "early" | "mid" | "late";

export function roleFor(position: number): Role {
  if (position === 3) return "offlane";
  if (position === 4 || position === 5) return "support";
  return "core";
}

export interface ItemInfo {
  id: number;
  key: string;
  name: string;
  cost: number;
  qual?: string;
  components: string[];
  img?: string;
}

export interface CounterRule {
  id: string;
  when: { trait: HeroTrait } | { stat: "magicShare" | "physicalShare"; min: number };
  how: string;
  items: Record<Role, string[]>;
}

export interface CounterRulesFile {
  patch: string;
  reviewed: string;
  rules: CounterRule[];
}

export interface AdvisorInput {
  heroId: number;
  position: number;
  enemies: number[];
  state: GameState;
  /** Item yang sudah dimiliki (id). */
  owned: number[];
  build: ItemBuild | null;
  profiles: HeroProfile[] | null;
  traits: HeroTraitsFile;
  rules: CounterRulesFile;
  items: Map<string, ItemInfo>;
  heroNames: Map<number, string>;
}

export interface BuildEntry {
  item: ItemInfo;
  /** Porsi pemain hero ini yang membeli item ini (0..1). */
  share: number;
  winRate: number;
  medianMinute: number;
  /** Winrate kalau dibeli pada/ sebelum menit median, dan sesudahnya. */
  onTimeWinRate: number | null;
  lateWinRate: number | null;
  owned: boolean;
}

export interface StartEntry {
  item: ItemInfo;
  count: number;
  share: number;
}

export interface SituationalEntry {
  item: ItemInfo;
  reasons: string[];
  score: number;
  owned: boolean;
  inBuild: boolean;
}

export interface DamageMix {
  physical: number;
  magical: number;
  pure: number;
}

export interface Advice {
  role: Role;
  starting: StartEntry[];
  boots: BuildEntry[];
  phases: Record<Phase, BuildEntry[]>;
  situational: SituationalEntry[];
  enemyDamage: DamageMix | null;
}

const PER_PHASE = 4;
/** Satu aturan paling banyak menyumbang sekian item, supaya alasan yang sama tidak berulang. */
const ITEMS_PER_RULE = 3;
/** Perbandingan tepat waktu vs terlambat hanya berarti untuk item mahal. */
const TIMING_MIN_COST = 2000;
const MIN_BUILD_SHARE = 0.08;
const MIN_ITEM_COST = 400;
const EARLY_END = 12;
const MID_END = 25;

// Aturan yang melindungi diri sendiri; didahulukan saat tertinggal.
const DEFENSIVE = new Set(["bkbPierce", "silence", "magicHeavy", "physicalHeavy", "invisibility"]);
// Aturan untuk menekan; didahulukan saat unggul.
const OFFENSIVE = new Set(["evasion", "escape", "passives", "dispellableBuffs", "heal"]);

export function phaseFor(minute: number): Phase {
  if (minute <= EARLY_END) return "early";
  if (minute <= MID_END) return "mid";
  return "late";
}

function pct(wins: number, matches: number) {
  return matches > 0 ? wins / matches : 0;
}

function toBuildEntry(b: BuildItem, item: ItemInfo, games: number, owned: Set<number>): BuildEntry {
  const before = b.timing.filter(([m]) => m <= b.medianMinute);
  const after = b.timing.filter(([m]) => m > b.medianMinute);
  const sum = (pts: typeof b.timing) =>
    pts.reduce((acc, [, n, w]) => ({ n: acc.n + n, w: acc.w + w }), { n: 0, w: 0 });
  const early = sum(before);
  const late = sum(after);
  const timed = item.cost >= TIMING_MIN_COST;
  return {
    item,
    share: Math.min(1, b.matches / Math.max(games, 1)),
    winRate: pct(b.wins, b.matches),
    medianMinute: b.medianMinute,
    onTimeWinRate: timed && early.n >= 50 ? pct(early.w, early.n) : null,
    lateWinRate: timed && late.n >= 50 ? pct(late.w, late.n) : null,
    owned: owned.has(item.id),
  };
}

export function teamDamage(enemies: number[], profiles: HeroProfile[] | null): DamageMix | null {
  if (!profiles || !enemies.length) return null;
  let physical = 0;
  let magical = 0;
  let pure = 0;
  for (const id of enemies) {
    const p = profiles.find((x) => x.heroId === id);
    if (!p) continue;
    physical += p.physicalDamage;
    magical += p.magicalDamage;
    pure += p.pureDamage;
  }
  const total = physical + magical + pure;
  if (!total) return null;
  return { physical: physical / total, magical: magical / total, pure: pure / total };
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

export function advise(input: AdvisorInput): Advice {
  const role = roleFor(input.position);
  const owned = new Set(input.owned);
  const byId = new Map([...input.items.values()].map((i) => [i.id, i]));

  // --- Build inti
  const build = input.build;
  const games = build?.games ?? 0;
  const bootIds = new Set(build?.boots.map((b) => b.itemId) ?? []);
  const buildItems = (build?.items ?? [])
    .map((b) => ({ b, item: byId.get(b.itemId) }))
    .filter((x): x is { b: BuildItem; item: ItemInfo } => Boolean(x.item))
    .filter(({ b, item }) => {
      if (item.qual === "consumable" || bootIds.has(item.id) || item.key === "boots") return false;
      if (item.cost < MIN_ITEM_COST) return false;
      return b.matches / Math.max(games, 1) >= MIN_BUILD_SHARE;
    });
  // Komponen yang biasanya jadi bagian item lain di build ini tidak ditampilkan terpisah.
  const shown = buildItems.filter(
    ({ b, item }) =>
      !buildItems.some(
        (other) =>
          other.item.components.includes(item.key) && other.b.medianMinute >= b.medianMinute,
      ),
  );

  const phases: Record<Phase, BuildEntry[]> = { early: [], mid: [], late: [] };
  for (const { b, item } of shown) {
    phases[phaseFor(b.medianMinute)].push(toBuildEntry(b, item, games, owned));
  }
  for (const phase of Object.keys(phases) as Phase[]) {
    phases[phase] = phases[phase]
      .sort((a, b) => b.share - a.share)
      .slice(0, PER_PHASE)
      .sort((a, b) => a.medianMinute - b.medianMinute);
  }

  const starting: StartEntry[] = (build?.starting ?? [])
    .map((s) => ({ s, item: byId.get(s.itemId) }))
    .filter((x) => x.item)
    .map(({ s, item }) => ({ item: item!, count: s.count, share: s.matches / Math.max(games, 1) }));

  const boots: BuildEntry[] = (build?.boots ?? [])
    .map((b) => ({ b, item: byId.get(b.itemId) }))
    // Boots of Speed biasa hanya komponen, bukan pilihan akhir.
    .filter((x) => x.item && x.item.key !== "boots")
    .filter((x) => x.b.matches / Math.max(games, 1) >= MIN_BUILD_SHARE)
    .map(({ b, item }) => ({
      item: item!,
      share: Math.min(1, b.matches / Math.max(games, 1)),
      winRate: pct(b.wins, b.matches),
      medianMinute: Math.round(b.avgTime / 60),
      onTimeWinRate: null,
      lateWinRate: null,
      owned: owned.has(item!.id),
    }));

  // --- Item situasional
  const enemyDamage = teamDamage(input.enemies, input.profiles);
  const buildKeys = new Set(shown.map((x) => x.item.key));
  const situational = new Map<string, SituationalEntry>();

  for (const rule of input.rules.rules) {
    let reason: string | null = null;
    let weight = 0;
    if ("trait" in rule.when) {
      const trait = rule.when.trait;
      const names = input.enemies
        .filter((id) => input.traits.heroes[String(id)]?.traits.includes(trait))
        .map((id) => input.heroNames.get(id) ?? `Hero ${id}`);
      if (!names.length) continue;
      const phrase = TRAIT_PHRASE[trait][names.length > 1 ? "many" : "one"];
      reason = `${joinNames(names)} ${phrase}. ${rule.how}`;
      weight = Math.min(names.length, 2);
    } else {
      const share = rule.when.stat === "magicShare" ? enemyDamage?.magical : enemyDamage?.physical;
      if (share === undefined || share < rule.when.min) continue;
      reason = `${rule.how} (${Math.round(share * 100)}% of their damage)`;
      weight = 1.5;
    }
    if (input.state === "behind" && DEFENSIVE.has(rule.id)) weight += 0.5;
    if (input.state === "ahead" && OFFENSIVE.has(rule.id)) weight += 0.5;

    for (const [rank, key] of rule.items[role].slice(0, ITEMS_PER_RULE).entries()) {
      const item = input.items.get(key);
      if (!item) continue; // item dihapus di patch baru
      const entry = situational.get(key) ?? {
        item,
        reasons: [],
        score: 0,
        owned: owned.has(item.id),
        inBuild: buildKeys.has(key),
      };
      // Item pertama di daftar aturan adalah pilihan utama.
      entry.score += weight * (rank === 0 ? 1 : 0.8);
      entry.reasons.push(reason);
      situational.set(key, entry);
    }
  }

  const sorted = [...situational.values()].sort((a, b) => {
    if (a.owned !== b.owned) return a.owned ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    // Saat tertinggal, item yang lebih murah lebih realistis.
    return input.state === "behind" ? a.item.cost - b.item.cost : 0;
  });

  return { role, starting, boots, phases, situational: sorted, enemyDamage };
}

/** Item inti yang dianggap patokan waktu; item murah seperti Magic Wand dilewati. */
const NEXT_ITEM_MIN_COST = 1000;
/** Terlambat sekian menit dari kebanyakan pemain dianggap "tertinggal". */
const BEHIND_MINUTES = 5;

export interface NextItem {
  entry: BuildEntry;
  /** Item inti sesudahnya, untuk gambaran urutan. */
  then: BuildEntry[];
  /** Selisih menit sekarang dengan menit beli yang biasa (positif = terlambat). Null kalau menit tidak diisi. */
  lateBy: number | null;
  status: "unknown" | "early" | "onTrack" | "late" | "behind";
}

/** Item inti berikutnya yang belum dimiliki, dan apakah pemain masih sesuai jadwal. */
export function nextItem(advice: Advice, minute: number | null): NextItem | null {
  const core = [...advice.phases.early, ...advice.phases.mid, ...advice.phases.late]
    .filter((e) => e.item.cost >= NEXT_ITEM_MIN_COST)
    .sort((a, b) => a.medianMinute - b.medianMinute);
  const pending = core.filter((e) => !e.owned);
  if (!pending.length) return null;
  const entry = pending[0];
  if (minute === null) return { entry, then: pending.slice(1, 3), lateBy: null, status: "unknown" };

  const lateBy = minute - entry.medianMinute;
  const status =
    lateBy <= -3 ? "early" : lateBy <= 1 ? "onTrack" : lateBy < BEHIND_MINUTES ? "late" : "behind";
  return { entry, then: pending.slice(1, 3), lateBy, status };
}
