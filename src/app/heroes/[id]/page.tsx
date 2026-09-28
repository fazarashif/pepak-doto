import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightning, ShieldSlash } from "@phosphor-icons/react/ssr";
import { FramedPanel, MaskedSvg } from "@/components/brand";
import { HeroPortrait } from "@/components/hero-portrait";
import { PowerCurve } from "@/components/power-curve";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { bracketFromRankTier, pct, type HeroInfo } from "@/lib/dota";
import { getHeroes } from "@/lib/heroes";
import type { ItemInfo, Role } from "@/lib/items/advisor";
import { loadCheatSheet, type CheatSheetData } from "@/lib/live/data";
import { heroTipsKey, storedAsResult, storedHeroTips } from "@/lib/llm/narratives";
import type { HeroTips } from "@/lib/llm/prompts/hero-tips";
import type { CoachResult } from "@/lib/llm/result";
import { HeroTipsPanel } from "./hero-tips";
import type { MatchupEntry } from "@/lib/plan/cheat-sheet";

const BRACKET_CHOICES = [
  { id: 0, label: "All ranks" },
  { id: 1, label: "Herald–Guardian" },
  { id: 3, label: "Crusader–Archon" },
  { id: 5, label: "Legend–Ancient" },
  { id: 7, label: "Divine–Immortal" },
];

const ROLE_LABEL: Record<Role, string> = { core: "Core", offlane: "Offlane", support: "Support" };

/** Rank 1..8 dipetakan ke pasangan rank STRATZ (1, 3, 5, 7). */
function bracketGroup(bracket: number) {
  return bracket ? bracket - ((bracket - 1) % 2) : 0;
}

function heroId(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id < 300 ? id : null;
}

export async function generateMetadata({ params }: PageProps<"/heroes/[id]">): Promise<Metadata> {
  const id = heroId((await params).id);
  const hero = id ? (await getHeroes().catch(() => [])).find((h) => h.id === id) : undefined;
  return hero
    ? {
        title: `How to play against ${hero.name}`,
        description: `Counters, items and dangerous abilities for playing against ${hero.name}.`,
      }
    : { title: "Hero" };
}

export default async function HeroCheatSheetPage({
  params,
  searchParams,
}: PageProps<"/heroes/[id]">) {
  const [{ id: rawId }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const id = heroId(rawId);
  if (!id) notFound();

  const r = Number(Array.isArray(sp.r) ? sp.r[0] : sp.r);
  const fromProfile = user ? user.preferredBracket || bracketFromRankTier(user.rankTier) : 0;
  const bracket = bracketGroup(Number.isInteger(r) && r >= 0 && r <= 8 ? r : fromProfile);

  let data: CheatSheetData | null = null;
  let failed = false;
  try {
    data = await loadCheatSheet(id, bracket);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[heroes] cheat sheet failed", err);
    failed = true;
  }
  if (!failed && !data) notFound();
  const tips = data ? storedAsResult(await storedHeroTips(heroTipsKey(id, bracket))) : null;

  return (
    <div className="mx-auto grid max-w-4xl gap-10 px-4 pt-10 sm:px-6">
      <Link
        href="/heroes"
        className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        All heroes
      </Link>

      {failed || !data ? (
        <div role="alert" className="rounded-lg border border-border bg-surface p-6">
          <p className="font-medium">This hero couldn&apos;t be loaded.</p>
          <p className="mt-1 text-sm text-muted">
            OpenDota might be busy or rate limiting us. Refresh the page in a minute.
          </p>
        </div>
      ) : (
        <CheatSheetView data={data} bracket={bracket} tips={tips} signedIn={Boolean(user)} />
      )}
    </div>
  );
}

function CheatSheetView({
  data,
  bracket,
  tips,
  signedIn,
}: {
  data: CheatSheetData;
  bracket: number;
  tips: CoachResult<HeroTips> | null;
  signedIn: boolean;
}) {
  const { hero, sheet } = data;
  const byId = new Map(data.heroes.map((h) => [h.id, h]));

  return (
    <>
      <header className="grid gap-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
        <HeroPortrait hero={hero} decorative priority />
        <div className="grid gap-3">
          <h1 className="font-display text-3xl font-bold">How to play against {hero.name}</h1>
          <nav aria-label="Rank" className="flex flex-wrap gap-2">
            {BRACKET_CHOICES.map((b) => (
              <Link
                key={b.id}
                href={`/heroes/${hero.id}?r=${b.id}`}
                aria-current={b.id === bracket ? "page" : undefined}
                scroll={false}
                className={cn(
                  "h-9 content-center rounded-full border px-3.5 text-sm transition-colors",
                  b.id === bracket
                    ? "border-accent-fg bg-accent-soft text-fg"
                    : "border-border text-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                {b.label}
              </Link>
            ))}
          </nav>
          <Link
            href={`/live?e=${hero.id}&r=${bracket}`}
            className="flex w-fit items-center gap-1 text-sm text-accent-fg underline-offset-4 hover:underline"
          >
            Plan a game against {hero.name}
            <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </header>

      <HeroTipsPanel
        key={bracket}
        heroId={hero.id}
        heroName={hero.name}
        bracket={bracket}
        initial={tips}
        signedIn={signedIn}
      />

      <FramedPanel as="section" tab="Counters" className="grid gap-4 p-5 sm:p-6">
        <div className="grid gap-1">
          <h2 className="font-display text-2xl font-bold">
            Heroes that do well against {hero.name}
          </h2>
          <p className="text-sm text-muted">
            Win rate edge over {hero.name} in {data.bracketLabel}, adjusted for how many games there
            are.
          </p>
        </div>
        {sheet.counters.length ? (
          <MatchupGrid entries={sheet.counters} byId={byId} sign="+" />
        ) : (
          <p className="text-sm">Matchup data isn&apos;t available for this rank yet.</p>
        )}
      </FramedPanel>

      {sheet.counterItems.length ? (
        <section aria-labelledby="items" className="grid gap-4">
          <h2 id="items" className="font-display text-2xl font-bold">
            Items that help
          </h2>
          <ul className="grid gap-3">
            {sheet.counterItems.map((group) => (
              <li
                key={group.reason}
                className="grid gap-3 rounded-lg border border-border bg-surface p-4"
              >
                <p className="flex items-start gap-1.5 text-sm">
                  <MaskedSvg
                    src="/brand/ornament-margin-note.svg"
                    className="mt-1.5 size-2.5 shrink-0 text-accent"
                  />
                  {group.reason}
                </p>
                <dl className="grid gap-2 sm:grid-cols-3">
                  {(Object.keys(ROLE_LABEL) as Role[]).map((role) =>
                    group.items[role].length ? (
                      <div key={role} className="grid content-start gap-1.5">
                        <dt className="text-xs text-muted">{ROLE_LABEL[role]}</dt>
                        <dd className="flex flex-wrap gap-1.5">
                          {group.items[role].map((item) => (
                            <ItemIcon key={item.key} item={item} />
                          ))}
                        </dd>
                      </div>
                    ) : null,
                  )}
                </dl>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sheet.dangerous.length ? (
        <section aria-labelledby="watch" className="grid gap-3">
          <h2 id="watch" className="font-display text-2xl font-bold">
            Watch out for
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {sheet.dangerous.map((a) => (
              <li
                key={a.key}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-surface p-4"
              >
                <Lightning size={16} aria-hidden className="text-accent-fg" />
                <span className="font-medium">{a.name}</span>
                {a.bkbPierce ? (
                  <span className="inline-flex items-center gap-1 rounded-sm border border-danger px-1.5 text-xs text-danger">
                    <ShieldSlash size={12} aria-hidden />
                    Goes through BKB
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="timing" className="grid gap-4">
        <h2 id="timing" className="font-display text-2xl font-bold">
          When {hero.name} is strongest
        </h2>
        <p>
          {sheet.peakMinute !== null
            ? `${hero.name} wins most often in games that end around minute ${sheet.peakMinute}${sheet.peakMinute >= 60 ? " or later" : ` to ${sheet.peakMinute + 5}`}. Plan your big fights away from that window.`
            : `${hero.name} doesn't have a clear peak by game length.`}
        </p>
        {sheet.strength.length ? (
          <PowerCurve
            label={`${hero.name}'s win rate by game length compared with its average.`}
            note="Win rate compared with the hero's average, by game length in minutes (all ranks)."
            series={[{ label: hero.name, variant: "accent", points: sheet.strength }]}
          />
        ) : null}
        {sheet.keyItems.length ? (
          <div className="grid gap-2">
            <h3 className="text-sm font-medium">Items that make {hero.name} dangerous</h3>
            <ul className="flex flex-wrap gap-3">
              {sheet.keyItems.map((k) => (
                <li key={k.item.key} className="flex items-center gap-2 text-sm">
                  <ItemIcon item={k.item} />
                  <span>
                    {k.item.name}
                    <span className="block font-mono text-xs text-muted tabular-nums">
                      ~{k.medianMinute} min, {pct(k.share, 0)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {sheet.damage ? <DamageLine hero={hero} damage={sheet.damage} /> : null}
      </section>

      {sheet.goodAgainst.length ? (
        <section aria-labelledby="victims" className="grid gap-4">
          <h2 id="victims" className="font-display text-2xl font-bold">
            Heroes {hero.name} does well against
          </h2>
          <p className="text-sm text-muted">Think twice before picking these into {hero.name}.</p>
          <MatchupGrid entries={sheet.goodAgainst} byId={byId} sign="-" />
        </section>
      ) : null}
    </>
  );
}

function MatchupGrid({
  entries,
  byId,
  sign,
}: {
  entries: MatchupEntry[];
  byId: Map<number, HeroInfo>;
  sign: "+" | "-";
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {entries.map((e) => {
        const h = byId.get(e.heroId);
        if (!h) return null;
        return (
          <li key={e.heroId}>
            <Link href={`/heroes/${h.id}`} className="group grid gap-1.5 rounded-md">
              <HeroPortrait hero={h} decorative />
              <span className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium group-hover:text-accent-fg">{h.name}</span>
                <span className="font-mono text-xs text-muted tabular-nums">
                  {sign}
                  {Math.abs(e.advantage).toFixed(1)}%
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function ItemIcon({ item }: { item: ItemInfo }) {
  return item.img ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.img}
      alt={item.name}
      title={item.name}
      width={88}
      height={64}
      loading="lazy"
      className="aspect-[88/64] w-12 rounded-md bg-surface-2"
    />
  ) : (
    <span className="rounded-md bg-surface-2 px-2 py-1 text-xs">{item.name}</span>
  );
}

function DamageLine({
  hero,
  damage,
}: {
  hero: HeroInfo;
  damage: { physical: number; magical: number; pure: number };
}) {
  return (
    <p className="text-sm text-muted">
      {hero.name}&apos;s damage: {pct(damage.physical, 0)} physical, {pct(damage.magical, 0)} magic
      {damage.pure >= 0.01 ? `, ${pct(damage.pure, 0)} pure` : ""}.
    </p>
  );
}
