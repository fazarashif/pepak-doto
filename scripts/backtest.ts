// Backtest skor draft terhadap hasil match publik.
//
//   npm run backtest                    150 match per kelompok rank (default)
//   npm run backtest -- --per-bracket 300
//   npm run backtest -- --fresh         abaikan cache di .data/backtest
//
// Untuk tiap match All Pick, skor kedua tim dihitung dengan rumus yang sama seperti Draft
// Assistant (counter, synergy, meta dari STRATZ), lalu dilihat seberapa sering tim dengan skor
// lebih tinggi benar-benar menang. Bobot terbaik dicari dengan regresi logistik.
//
// Catatan: statistik STRATZ dihitung dari match terbaru, yang bisa saja mencakup sebagian kecil
// match yang dites di sini. Efeknya kecil karena STRATZ memakai jutaan match, tapi hasilnya
// sedikit optimis.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  counterAgainst,
  metaScore,
  synergyWith,
  WEIGHTS,
  type DraftData,
  type HeroMatchupTable,
  type PositionStat,
} from "../src/lib/draft/engine";

try {
  process.loadEnvFile(".env.local");
} catch {
  // boleh tidak ada kalau STRATZ_TOKEN sudah di environment
}

const args = process.argv.slice(2);
const perBracket = Number(args[args.indexOf("--per-bracket") + 1]) || 150;
const fresh = args.includes("--fresh");
// Herald dan Guardian jarang muncul di daftar match publik, jadi butuh banyak halaman.
const maxPages = Number(args[args.indexOf("--max-pages") + 1]) || 250;
// Bobot lain untuk dibandingkan, mis. --weights 1,0.2,0.5 (counter, synergy, meta).
const weightsArg = args.includes("--weights") ? args[args.indexOf("--weights") + 1] : null;
const CACHE_DIR = path.join(process.cwd(), ".data", "backtest");
mkdirSync(CACHE_DIR, { recursive: true });

const GROUPS = [
  { name: "HERALD_GUARDIAN", label: "Herald-Guardian", min: 10, max: 29 },
  { name: "CRUSADER_ARCHON", label: "Crusader-Archon", min: 30, max: 49 },
  { name: "LEGEND_ANCIENT", label: "Legend-Ancient", min: 50, max: 69 },
  { name: "DIVINE_IMMORTAL", label: "Divine-Immortal", min: 70, max: 85 },
] as const;
type GroupName = (typeof GROUPS)[number]["name"];

interface PublicMatch {
  match_id: number;
  radiant_win: boolean;
  duration: number;
  game_mode: number;
  avg_rank_tier: number;
  num_rank_tier: number;
  radiant_team: number[];
  dire_team: number[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function cachedJson<T>(name: string): T | null {
  const file = path.join(CACHE_DIR, name);
  if (fresh || !existsSync(file)) return null;
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function saveJson(name: string, value: unknown) {
  writeFileSync(path.join(CACHE_DIR, name), JSON.stringify(value));
}

async function fetchJson<T>(url: string, init?: RequestInit, attempt = 1): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 429 && attempt <= 5) {
    await sleep(5000 * attempt);
    return fetchJson(url, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return (await res.json()) as T;
}

// ---- Match publik dari OpenDota ----

async function loadMatches(group: (typeof GROUPS)[number]): Promise<PublicMatch[]> {
  const cacheName = `matches-${group.name}.json`;
  const hit = cachedJson<PublicMatch[]>(cacheName);
  // Cache dipakai apa adanya (juga kalau isinya kurang); pakai --fresh untuk mengambil ulang.
  if (hit) return hit.slice(0, perBracket);

  const found: PublicMatch[] = [];
  let before: number | undefined;
  for (let page = 0; page < maxPages && found.length < perBracket; page++) {
    const url = new URL("https://api.opendota.com/api/publicMatches");
    url.searchParams.set("min_rank", String(group.min));
    url.searchParams.set("max_rank", String(group.max));
    if (before) url.searchParams.set("less_than_match_id", String(before));
    const rows = await fetchJson<PublicMatch[]>(url.toString());
    if (!rows.length) break;
    before = Math.min(...rows.map((r) => r.match_id));
    for (const m of rows) {
      const ok =
        m.game_mode === 22 &&
        m.duration >= 15 * 60 &&
        m.num_rank_tier >= 5 &&
        m.radiant_team?.length === 5 &&
        m.dire_team?.length === 5;
      if (ok) found.push(m);
    }
    process.stdout.write(`\r  ${group.label}: ${found.length}/${perBracket} matches`);
    await sleep(1100); // OpenDota: 60 request per menit
  }
  process.stdout.write("\n");
  saveJson(cacheName, found);
  return found.slice(0, perBracket);
}

// ---- Data STRATZ ----

const STRATZ = "https://api.stratz.com/graphql";

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const token = process.env.STRATZ_TOKEN;
  if (!token) throw new Error("STRATZ_TOKEN is not set (.env.local)");
  const body = await fetchJson<{ data?: T; errors?: { message: string }[] }>(STRATZ, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "STRATZ_API",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data as T;
}

const POSITIONS_QUERY = `query P($b: [RankBracketBasicEnum]) { heroStats { stats(bracketBasicIds: $b, groupByPosition: true) { heroId position matchCount winCount } } }`;
const MATCHUP_QUERY = `query M($h: Short!, $b: [RankBracketBasicEnum]) { heroStats { heroVsHeroMatchup(heroId: $h, bracketBasicIds: $b, take: 200) { advantage { with { heroId2 matchCount synergy } vs { heroId2 matchCount synergy } } } } }`;

interface Pair {
  heroId2: number;
  matchCount: number;
  synergy: number;
}

async function loadGroupData(group: GroupName, heroIds: number[]): Promise<DraftData> {
  const posName = `positions-${group}.json`;
  let rows =
    cachedJson<{ heroId: number; position: string; matchCount: number; winCount: number }[]>(
      posName,
    );
  if (!rows) {
    const data = await gql<{ heroStats: { stats: NonNullable<typeof rows> } }>(POSITIONS_QUERY, {
      b: [group],
    });
    rows = data.heroStats.stats;
    saveJson(posName, rows);
  }
  const positions = new Map<number, PositionStat[]>();
  for (const r of rows) {
    const list =
      positions.get(r.heroId) ?? Array.from({ length: 5 }, () => ({ matches: 0, wins: 0 }));
    const p = Number(r.position.replace("POSITION_", ""));
    if (p >= 1 && p <= 5) list[p - 1] = { matches: r.matchCount, wins: r.winCount };
    positions.set(r.heroId, list);
  }

  const muName = `matchups-${group}.json`;
  const tables = cachedJson<Record<string, { with: Pair[]; vs: Pair[] }>>(muName) ?? {};
  const missing = heroIds.filter((id) => !tables[id]);
  let done = 0;
  for (const id of missing) {
    const data = await gql<{
      heroStats: { heroVsHeroMatchup: { advantage: { with: Pair[]; vs: Pair[] }[] } | null };
    }>(MATCHUP_QUERY, { h: id, b: [group] });
    tables[id] = data.heroStats.heroVsHeroMatchup?.advantage[0] ?? { with: [], vs: [] };
    done++;
    process.stdout.write(`\r  STRATZ ${group}: ${done}/${missing.length} heroes`);
    await sleep(450); // STRATZ: 150 request per menit
    if (done % 25 === 0) saveJson(muName, tables);
  }
  if (missing.length) {
    process.stdout.write("\n");
    saveJson(muName, tables);
  }

  const matchups = new Map<number, HeroMatchupTable>();
  for (const [id, t] of Object.entries(tables)) {
    const toMap = (list: Pair[]) =>
      new Map(list.map((p) => [p.heroId2, { synergy: p.synergy, matchCount: p.matchCount }]));
    matchups.set(Number(id), { with: toMap(t.with), vs: toMap(t.vs) });
  }
  return { heroes: [], positions, matchups };
}

// ---- Skor tim ----

function teamFeatures(team: number[], enemy: number[], data: DraftData) {
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    counter: avg(team.map((h) => counterAgainst(h, enemy, data).mean)),
    synergy: avg(
      team.map(
        (h) =>
          synergyWith(
            h,
            team.filter((x) => x !== h),
            data,
          ).mean,
      ),
    ),
    meta: avg(team.map((h) => metaScore(data.positions.get(h), 0).pp)),
  };
}

interface Row {
  group: string;
  x: [number, number, number]; // selisih radiant - dire: counter, synergy, meta
  y: 0 | 1;
}

// ---- Statistik ----

function sigmoid(z: number) {
  return 1 / (1 + Math.exp(-z));
}

/** Regresi logistik dengan intercept, diselesaikan dengan Newton-Raphson. */
function fitLogistic(rows: { x: number[]; y: number }[], ridge = 1e-3) {
  const k = rows[0].x.length + 1;
  let beta = new Array(k).fill(0);
  for (let iter = 0; iter < 50; iter++) {
    const grad = new Array(k).fill(0);
    const hess = Array.from({ length: k }, () => new Array(k).fill(0));
    for (const r of rows) {
      const xi = [1, ...r.x];
      const p = sigmoid(xi.reduce((s, v, j) => s + v * beta[j], 0));
      for (let a = 0; a < k; a++) {
        grad[a] += (r.y - p) * xi[a];
        for (let b = 0; b < k; b++) hess[a][b] -= p * (1 - p) * xi[a] * xi[b];
      }
    }
    for (let a = 1; a < k; a++) {
      grad[a] -= ridge * beta[a];
      hess[a][a] -= ridge;
    }
    const step = solve(hess, grad);
    beta = beta.map((b, i) => b - step[i]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return beta;
}

/** Selesaikan A·x = b dengan eliminasi Gauss. */
function solve(A: number[][], b: number[]) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[pivot][c])) pivot = r;
    [M[c], M[pivot]] = [M[pivot], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= f * M[c][j];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

interface Scored {
  p: number;
  y: number;
}

function predict(beta: number[], x: number[]) {
  return sigmoid(beta[0] + x.reduce((s, v, j) => s + v * beta[j + 1], 0));
}

function summarize(list: Scored[]) {
  const correct = list.filter((s) => (s.p >= 0.5 ? 1 : 0) === s.y).length;
  const logLoss =
    -list.reduce((acc, s) => acc + s.y * Math.log(s.p) + (1 - s.y) * Math.log(1 - s.p), 0) /
    list.length;
  return { accuracy: correct / list.length, logLoss, auc: auc(list) };
}

/** Peluang skor tim pemenang lebih tinggi dari skor tim kalah (0.5 = tebakan acak). */
function auc(scored: { p: number; y: number }[]) {
  const pos = scored.filter((s) => s.y === 1).map((s) => s.p);
  const neg = scored.filter((s) => s.y === 0).map((s) => s.p);
  let wins = 0;
  for (const a of pos) for (const b of neg) wins += a > b ? 1 : a === b ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

/** Akurasi kalau yang diprediksi menang adalah tim dengan skor (tertimbang) lebih tinggi. */
function signAccuracy(rows: Row[], w: number[]) {
  const withSignal = rows.filter((r) => r.x.some((v, i) => w[i] && v));
  const correct = withSignal.filter((r) => {
    const s = r.x.reduce((acc, v, i) => acc + v * w[i], 0);
    return (s > 0 ? 1 : 0) === r.y;
  }).length;
  return correct / withSignal.length;
}

// Pengacak dengan seed tetap supaya pembagian train/test sama setiap kali dijalankan.
function shuffled<T>(list: T[], seed = 42) {
  const out = [...list];
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

// ---- Main ----

async function main() {
  console.log(`Backtest draft score, ${perBracket} matches per rank group\n`);
  const rows: Row[] = [];

  for (const group of GROUPS) {
    const matches = await loadMatches(group);
    const heroIds = [...new Set(matches.flatMap((m) => [...m.radiant_team, ...m.dire_team]))];
    const data = await loadGroupData(group.name, heroIds);
    for (const m of matches) {
      const r = teamFeatures(m.radiant_team, m.dire_team, data);
      const d = teamFeatures(m.dire_team, m.radiant_team, data);
      rows.push({
        group: group.label,
        x: [r.counter - d.counter, r.synergy - d.synergy, r.meta - d.meta],
        y: m.radiant_win ? 1 : 0,
      });
    }
  }

  const n = rows.length;
  const radiantRate = rows.filter((r) => r.y === 1).length / n;
  const current = weightsArg
    ? weightsArg.split(",").map(Number)
    : [WEIGHTS.counter, WEIGHTS.synergy, WEIGHTS.meta];

  console.log(`\nMatches: ${n}. Radiant won ${pct(radiantRate)}.\n`);
  console.log("Picking the team with the higher score (ignores matches where the score is 0):");
  console.log(`  counter only   ${pct(signAccuracy(rows, [1, 0, 0]))}`);
  console.log(`  synergy only   ${pct(signAccuracy(rows, [0, 1, 0]))}`);
  console.log(`  meta only      ${pct(signAccuracy(rows, [0, 0, 1]))}`);
  console.log(
    `  current mix    ${pct(signAccuracy(rows, current))}  (weights ${current.join(" / ")})`,
  );

  // 5-fold cross-validation: tiap match dipakai tepat sekali sebagai data uji.
  const all = shuffled(rows);
  const folds = 5;
  // Bobot sekarang: hanya skala dan intercept yang dicocokkan, rasio antar komponen tetap.
  const combined = (r: Row) => ({ x: [r.x.reduce((s, v, i) => s + v * current[i], 0)], y: r.y });
  const scores = {
    base: [] as Scored[],
    current: [] as Scored[],
    fitted: [] as Scored[],
  };
  for (let f = 0; f < folds; f++) {
    const test = all.filter((_, i) => i % folds === f);
    const train = all.filter((_, i) => i % folds !== f);
    const bFit = fitLogistic(train);
    const bCur = fitLogistic(train.map(combined));
    const bBase = fitLogistic(train.map((r) => ({ x: [0], y: r.y })));
    for (const r of test) {
      scores.fitted.push({ p: predict(bFit, r.x), y: r.y });
      scores.current.push({ p: predict(bCur, combined(r).x), y: r.y });
      scores.base.push({ p: predict(bBase, [0]), y: r.y });
    }
  }
  const evBase = summarize(scores.base);
  const evCurrent = summarize(scores.current);
  const evFitted = summarize(scores.fitted);
  const fitted = fitLogistic(all);
  const margin = `±${(1.96 * Math.sqrt(0.25 / n) * 100).toFixed(1)}`;

  const rel = (b: number) => (b / fitted[1]).toFixed(2);
  console.log(`\n5-fold cross-validation on all ${n} matches (margin of error ${margin} points):`);
  console.log(
    `  radiant only    accuracy ${pct(evBase.accuracy)}  log loss ${evBase.logLoss.toFixed(4)}`,
  );
  console.log(
    `  current weights accuracy ${pct(evCurrent.accuracy)}  log loss ${evCurrent.logLoss.toFixed(4)}  AUC ${evCurrent.auc.toFixed(3)}`,
  );
  console.log(
    `  fitted weights  accuracy ${pct(evFitted.accuracy)}  log loss ${evFitted.logLoss.toFixed(4)}  AUC ${evFitted.auc.toFixed(3)}`,
  );
  console.log(
    `\nFitted weights relative to counter = 1: synergy ${rel(fitted[2])}, meta ${rel(fitted[3])}` +
      `  (raw: counter ${fitted[1].toFixed(3)}, synergy ${fitted[2].toFixed(3)}, meta ${fitted[3].toFixed(3)}, intercept ${fitted[0].toFixed(3)})`,
  );

  console.log("\nBy rank group (current mix):");
  for (const g of GROUPS) {
    const subset = rows.filter((r) => r.group === g.label);
    console.log(
      `  ${g.label.padEnd(16)} ${pct(signAccuracy(subset, current))}  (${subset.length} matches)`,
    );
  }

  const result = {
    date: new Date().toISOString(),
    matches: n,
    radiantRate,
    signAccuracy: {
      counter: signAccuracy(rows, [1, 0, 0]),
      synergy: signAccuracy(rows, [0, 1, 0]),
      meta: signAccuracy(rows, [0, 0, 1]),
      current: signAccuracy(rows, current),
    },
    crossValidated: { folds, base: evBase, current: evCurrent, fitted: evFitted },
    fittedWeights: {
      intercept: fitted[0],
      counter: fitted[1],
      synergy: fitted[2],
      meta: fitted[3],
    },
    currentWeights: WEIGHTS,
  };
  saveJson("last-result.json", result);
  console.log(`\nSaved ${path.join(".data", "backtest", "last-result.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
