// Membuat draf sifat hero dari deskripsi skill OpenDota, untuk direview manual.
//
//   npm run draft:hero-traits
//
// Hasilnya ditulis ke .data/hero-traits.draft.json (tidak di-commit): tiap hero berisi sifat
// yang terdeteksi beserta skill yang jadi buktinya, dan perbedaannya dengan data/hero-traits.json.
// Draf ini hanya titik awal. Kata kunci di deskripsi sering salah tangkap (mis. "tidak berlaku
// untuk ilusi"), jadi data/hero-traits.json tetap diperiksa dan disunting manual setiap patch.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { HERO_TRAITS, type HeroTrait } from "../src/lib/items/traits";

interface Ability {
  dname?: string;
  desc?: string;
  behavior?: string | string[];
  target_team?: string | string[];
  bkbpierce?: string;
  dispellable?: string;
}

interface HeroConst {
  id: number;
  name: string;
  localized_name: string;
}

const BASE = "https://api.opendota.com/api/constants";

async function get<T>(name: string): Promise<T> {
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`OpenDota ${res.status} for ${name}`);
  return (await res.json()) as T;
}

const list = (v: string | string[] | undefined) => (Array.isArray(v) ? v : v ? [v] : []);

type Rule = (a: Ability, text: string, behavior: string[]) => boolean;

const DISABLE = /stun|hex|root|pull|sleep|taunt|fear|cyclone|banish|silenc|disable|immobil|lift/i;

const RULES: Partial<Record<HeroTrait, Rule>> = {
  illusions: (_, t) =>
    /(creat|summon|spawn|conjur|generat|fractur)\w*[^.]{0,60}illusion|illusions? of (him|her|it)self/i.test(
      t,
    ),
  evasion: (_, t) => /evasion|chance to evade|evade attacks/i.test(t),
  heal: (_, t) => /\bheal|lifesteal|restores? [^.]{0,30}health|health regen/i.test(t),
  invisibility: (_, t) => /invisib/i.test(t) && !/reveal/i.test(t),
  summons: (_, t) => /summon|spawns? /i.test(t) && !/illusion/i.test(t),
  silence: (a, t) => /silenc/i.test(t) && list(a.target_team).includes("Enemy"),
  escape: (a, t, b) =>
    !b.includes("Passive") &&
    /blink|teleport|leap|jump|dash|charges? (forward|toward)|fly|flies|ethereal|shukuchi|phases? /i.test(
      t,
    ),
  dispellableBuffs: (a, t, b) =>
    a.dispellable === "Yes" &&
    !b.includes("Passive") &&
    !list(a.target_team).includes("Enemy") &&
    /bonus|armor|damage|speed|heal|shield|barrier|absorb|regen/i.test(t),
  bkbPierce: (a, t) => a.bkbpierce === "Yes" && DISABLE.test(t),
};

async function main() {
  const [heroes, heroAbilities, abilities] = await Promise.all([
    get<Record<string, HeroConst>>("heroes"),
    get<Record<string, { abilities: string[] }>>("hero_abilities"),
    get<Record<string, Ability>>("abilities"),
  ]);

  const currentPath = path.join(process.cwd(), "data", "hero-traits.json");
  const current = existsSync(currentPath)
    ? (JSON.parse(readFileSync(currentPath, "utf8")) as {
        heroes: Record<string, { traits: HeroTrait[]; dangerous: string[] }>;
      })
    : null;

  const out: Record<string, unknown> = {};
  const problems: string[] = [];
  for (const hero of Object.values(heroes).sort((a, b) => a.id - b.id)) {
    const keys = (heroAbilities[hero.name]?.abilities ?? []).filter(
      (k) => k !== "generic_hidden" && abilities[k],
    );
    const evidence: Partial<Record<HeroTrait, string[]>> = {};
    let passives = 0;
    const channeled: string[] = [];
    for (const key of keys) {
      const a = abilities[key];
      const behavior = list(a.behavior);
      if (behavior.includes("Hidden")) continue;
      const text = `${a.dname ?? ""}. ${a.desc ?? ""}`;
      if (behavior.includes("Passive")) passives++;
      if (behavior.includes("Channeled")) channeled.push(key);
      for (const [trait, rule] of Object.entries(RULES) as [HeroTrait, Rule][]) {
        if (rule(a, text, behavior)) (evidence[trait] ??= []).push(a.dname ?? key);
      }
    }
    if (passives >= 2) evidence.passives = [`${passives} passive abilities`];

    const ultimate = keys.at(-1);
    const detected = Object.keys(evidence) as HeroTrait[];
    const entry = current?.heroes[String(hero.id)];
    const reviewed = entry?.traits ?? null;
    // Skill yang diganti atau dihapus patch baru harus diperbarui di data/hero-traits.json.
    const unknownDangerous = (entry?.dangerous ?? []).filter((k) => !abilities[k]);
    if (unknownDangerous.length)
      problems.push(`${hero.localized_name}: ${unknownDangerous.join(", ")}`);
    out[String(hero.id)] = {
      name: hero.localized_name,
      detected,
      evidence,
      dangerousDraft: [...new Set([ultimate, ...channeled].filter(Boolean))],
      ...(reviewed
        ? {
            onlyInDraft: detected.filter((t) => !reviewed.includes(t)),
            onlyInReviewed: reviewed.filter((t) => !detected.includes(t)),
          }
        : { new: true }),
    };
  }

  const dir = path.join(process.cwd(), ".data");
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "hero-traits.draft.json");
  writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Wrote ${Object.keys(out).length} heroes to ${file}`);
  console.log(`Traits: ${HERO_TRAITS.join(", ")}`);
  const missing = Object.values(heroes).filter((h) => current && !current.heroes[String(h.id)]);
  if (missing.length) {
    const names = missing.map((h) => h.localized_name).join(", ");
    console.log(`Heroes missing from data/hero-traits.json: ${names}`);
  }
  if (problems.length) {
    console.log("Dangerous abilities that no longer exist:");
    for (const p of problems) console.log(`  ${p}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
