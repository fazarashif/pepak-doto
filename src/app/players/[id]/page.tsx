import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react/ssr";
import { MaskedSvg } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { rankTierLabel } from "@/lib/dota";
import { getHeroes } from "@/lib/heroes";
import { loadPlayer } from "@/lib/players/data";
import { GoalsView } from "./goals-view";
import { HeroesView } from "./heroes-view";
import { TrendsView } from "./trends-view";
import { WardsView } from "./wards-view";

const TABS = [
  { id: "trends", label: "Trends" },
  { id: "heroes", label: "Heroes" },
  { id: "goals", label: "Goals" },
  { id: "wards", label: "Wards" },
] as const;
type Tab = (typeof TABS)[number]["id"];

function accountIdFrom(raw: string) {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 && id < 2 ** 32 ? id : null;
}

export async function generateMetadata({ params }: PageProps<"/players/[id]">): Promise<Metadata> {
  const id = accountIdFrom((await params).id);
  return { title: id ? `Player ${id}` : "Player", robots: { index: false } };
}

export default async function PlayerPage({ params, searchParams }: PageProps<"/players/[id]">) {
  const [{ id: raw }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const accountId = accountIdFrom(raw);
  if (!accountId) notFound();

  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tab: Tab = TABS.some((t) => t.id === first(sp.tab)) ? (first(sp.tab) as Tab) : "trends";
  const size = first(sp.n) === "20" ? 20 : 50;
  const isOwner = user?.accountId === accountId;

  const [player, heroes] = await Promise.all([loadPlayer(accountId, size), getHeroes()]);
  const heroById = new Map(heroes.map((h) => [h.id, h]));

  if (player.status === "not-found") {
    return (
      <Message
        title="We couldn't find this player"
        body="OpenDota doesn't know this account. Check the Friend ID, or play a match with public match data turned on first."
      />
    );
  }
  if (player.status === "error") {
    return <Message title="Player data isn't available right now" body={player.message} />;
  }
  if (player.status === "private") {
    return (
      <Message
        title={`${player.name}'s matches are private`}
        body="Turn on Expose Public Match Data in the Dota 2 settings, then play a match. The profile fills in after that."
        image="/brand/empty-match-private.svg"
      />
    );
  }

  const tabHref = (t: Tab) => `/players/${accountId}?tab=${t}${size === 20 ? "&n=20" : ""}`;

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 pt-10 sm:px-6">
      <Link
        href="/players"
        className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        Players
      </Link>

      <header className="flex flex-wrap items-center gap-5">
        {player.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.avatar} alt="" width={72} height={72} className="size-18 rounded-lg" />
        ) : null}
        <div className="grid gap-1">
          <h1 className="font-display text-3xl font-bold">{player.name}</h1>
          <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong px-2 py-0.5 font-display-sc font-bold text-fg">
              <MaskedSvg src="/brand/logo-symbol-small.svg" className="size-4 text-accent" />
              {rankTierLabel(player.rankTier)}
            </span>
            <span className="font-mono tabular-nums">Friend ID {accountId}</span>
            {isOwner ? <span>This is you</span> : null}
          </p>
        </div>
      </header>

      <nav
        aria-label="Profile sections"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id)}
            scroll={false}
            aria-current={tab === t.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-4 py-2.5 text-sm whitespace-nowrap transition-colors",
              tab === t.id
                ? "border-accent-fg font-medium text-fg"
                : "border-transparent text-muted hover:text-fg",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "trends" ? (
        <TrendsView
          player={player}
          heroes={heroById}
          size={size}
          signedIn={Boolean(user)}
          isOwner={isOwner}
        />
      ) : tab === "heroes" ? (
        <HeroesView accountId={accountId} rankTier={player.rankTier} heroes={heroById} />
      ) : tab === "goals" ? (
        <GoalsView
          accountId={accountId}
          isOwner={isOwner}
          signedIn={Boolean(user)}
          userId={user?.id ?? null}
          heroes={heroById}
          recentHeroIds={[...new Set(player.summaries.map((s) => s.heroId))]}
        />
      ) : (
        <WardsView accountId={accountId} player={player} />
      )}
    </div>
  );
}

function Message({ title, body, image }: { title: string; body: string; image?: string }) {
  return (
    <div className="mx-auto grid max-w-xl justify-items-center gap-4 px-4 pt-16 text-center">
      {image ? <MaskedSvg src={image} className="h-32 w-44 text-accent" /> : null}
      <h1 className="font-display text-2xl font-bold">{title}</h1>
      <p className="text-muted">{body}</p>
      <Link href="/players" className="text-sm text-accent-fg underline-offset-4 hover:underline">
        Look up another player
      </Link>
    </div>
  );
}
