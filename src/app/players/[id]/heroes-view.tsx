import Link from "next/link";
import { HeroPortrait } from "@/components/hero-portrait";
import { bracketFromRankTier, bracketGroupLabel, POSITIONS, pct, type HeroInfo } from "@/lib/dota";
import { getPositions } from "@/lib/hero-data/store";
import { opendota } from "@/lib/opendota/client";
import {
  buildHeroPool,
  FREQUENT_GAMES,
  MIN_GAMES,
  QUADRANT_INFO,
  type PoolHero,
  type Quadrant,
} from "@/lib/players/hero-pool";

const ORDER: Quadrant[] = ["core", "potential", "trap", "avoid"];

export async function HeroesView({
  accountId,
  rankTier,
  heroes,
}: {
  accountId: number;
  rankTier: number | null;
  heroes: Map<number, HeroInfo>;
}) {
  const bracket = bracketFromRankTier(rankTier);
  const [played, positions] = await Promise.all([
    opendota.playerHeroes(accountId).catch(() => null),
    getPositions(bracket),
  ]);

  if (!played || !positions?.length) {
    return (
      <p className="rounded-lg border border-border bg-surface p-5 text-sm">
        Hero data couldn&apos;t be loaded right now. Try again in a minute.
      </p>
    );
  }

  const pool = buildHeroPool(played, positions);
  if (!pool.heroes.length) {
    return (
      <p className="rounded-lg border border-border bg-surface p-5 text-sm">
        Not enough games in the last year yet. Heroes show up here after {MIN_GAMES} games.
      </p>
    );
  }

  return (
    <div className="grid gap-10">
      <p className="max-w-[70ch] text-sm text-muted">
        Games from the last 12 months. Your win rate on each hero is compared with how that hero
        does in {bracketGroupLabel(bracket)}. &quot;A lot&quot; means {FREQUENT_GAMES} games or
        more, and small samples are pulled toward the average so a lucky streak doesn&apos;t look
        like a trend.
      </p>

      <section aria-labelledby="focus" className="grid gap-3">
        <h2 id="focus" className="font-display text-2xl font-bold">
          Heroes to focus on
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {POSITIONS.filter((p) => p.id > 0).map((p) => (
            <li
              key={p.id}
              className="grid content-start gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <h3 className="text-sm font-medium">{p.name}</h3>
              {pool.focus[p.id].length ? (
                <ul className="grid gap-2">
                  {pool.focus[p.id].map((h) => (
                    <HeroChip key={h.heroId} entry={h} hero={heroes.get(h.heroId)} />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted">No strong hero here yet.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {ORDER.map((q) => (
          <section
            key={q}
            aria-labelledby={`q-${q}`}
            className="grid content-start gap-3 rounded-lg border border-border bg-surface p-4"
          >
            <div className="grid gap-0.5">
              <h2 id={`q-${q}`} className="font-display text-xl font-bold">
                {QUADRANT_INFO[q].label}{" "}
                <span className="font-mono text-sm font-normal text-muted tabular-nums">
                  {pool.byQuadrant[q].length}
                </span>
              </h2>
              <p className="text-sm text-muted">{QUADRANT_INFO[q].hint}</p>
            </div>
            {pool.byQuadrant[q].length ? (
              <ul className="grid gap-2">
                {pool.byQuadrant[q].slice(0, 8).map((h) => (
                  <HeroChip key={h.heroId} entry={h} hero={heroes.get(h.heroId)} />
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None.</p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function HeroChip({ entry, hero }: { entry: PoolHero; hero?: HeroInfo }) {
  if (!hero) return null;
  const edge = Math.round(entry.edge * 1000) / 10;
  return (
    <li>
      <Link
        href={`/heroes/${hero.id}`}
        className="group grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-2.5"
      >
        <HeroPortrait hero={hero} decorative />
        <span className="grid min-w-0 text-sm">
          <span className="truncate font-medium group-hover:text-accent-fg">{hero.name}</span>
          <span className="font-mono text-xs text-muted tabular-nums">
            {entry.wins}–{entry.games - entry.wins}, {pct(entry.wins / entry.games, 0)} ·{" "}
            {edge >= 0 ? "+" : ""}
            {edge.toFixed(1)} vs avg
          </span>
        </span>
      </Link>
    </li>
  );
}
