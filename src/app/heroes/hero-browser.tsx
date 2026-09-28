"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { FramedPanel, MaskedSvg } from "@/components/brand";
import { HeroPicker } from "@/components/hero-picker";
import { HeroPortrait } from "@/components/hero-portrait";
import { ATTR_LABEL, BRACKETS, pct } from "@/lib/dota";
import type { HeroWithMeta } from "@/lib/heroes";

export function HeroBrowser({ heroes }: { heroes: HeroWithMeta[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const selected = useMemo(() => {
    const id = Number(params.get("hero"));
    return heroes.find((h) => h.id === id) ?? null;
  }, [heroes, params]);

  const selectedIds = useMemo(() => new Set(selected ? [selected.id] : []), [selected]);

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <HeroPicker
        heroes={heroes}
        selectedIds={selectedIds}
        onPick={(hero) => router.replace(`${pathname}?hero=${hero.id}`, { scroll: false })}
        className="order-2 lg:order-1"
      />

      <FramedPanel as="aside" className="order-1 p-6 lg:sticky lg:top-24 lg:order-2">
        <div aria-live="polite">
          {selected ? (
            <HeroDetail hero={selected} />
          ) : (
            <div className="grid justify-items-start gap-3">
              <MaskedSvg src="/brand/spot-draft.svg" className="h-24 w-36 text-accent" />
              <p className="text-sm text-muted">
                Select a hero from the list to see its win rate by rank.
              </p>
            </div>
          )}
        </div>
      </FramedPanel>
    </div>
  );
}

function HeroDetail({ hero }: { hero: HeroWithMeta }) {
  const { brackets, pro } = hero.meta;
  const proGames = pro.picks;

  return (
    <div className="grid gap-5">
      <HeroPortrait hero={hero} decorative priority />
      <div className="grid gap-1">
        <h2 className="font-display text-xl font-bold">{hero.name}</h2>
        <p className="text-sm text-muted">
          {ATTR_LABEL[hero.primaryAttr]}, {hero.attackType.toLowerCase()}
        </p>
      </div>

      <Link
        href={`/heroes/${hero.id}`}
        className="flex w-fit items-center gap-1 text-sm font-medium text-accent-fg underline-offset-4 hover:underline"
      >
        How to play against {hero.name}
        <ArrowRight size={14} aria-hidden />
      </Link>

      <ul className="flex flex-wrap gap-1.5" aria-label="Roles">
        {hero.roles.map((role) => (
          <li key={role} className="rounded-md bg-surface-2 px-2 py-1 text-xs">
            {role}
          </li>
        ))}
      </ul>

      <section className="grid gap-3">
        <h3 className="text-sm font-medium">Win rate by rank</h3>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2">
          {brackets.map((b, i) =>
            b.picks ? (
              <div key={i} className="rounded-md border border-border px-3 py-2">
                <dt className="text-xs text-muted">{BRACKETS[i + 1].name}</dt>
                <dd className="font-mono text-base tabular-nums">{pct(b.wins / b.picks)}</dd>
                <dd className="font-mono text-xs text-muted tabular-nums">
                  {b.picks.toLocaleString("en-US")} games
                </dd>
              </div>
            ) : null,
          )}
        </dl>
        {brackets[7].picks === 0 ? (
          <p className="text-xs text-muted">OpenDota doesn&apos;t have Immortal data right now.</p>
        ) : null}
      </section>

      <section className="grid gap-1 text-sm">
        <h3 className="font-medium">Pro matches</h3>
        <p className="text-muted">
          {proGames
            ? `${proGames} picks, ${pro.bans} bans, ${pct(pro.wins / proGames)} win rate`
            : `Not picked recently, ${pro.bans} bans`}
        </p>
      </section>
    </div>
  );
}
