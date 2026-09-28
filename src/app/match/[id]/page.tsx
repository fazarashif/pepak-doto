import type { Metadata } from "next";
import Link from "next/link";
import { notFound, unstable_rethrow } from "next/navigation";
import { MaskedSvg } from "@/components/brand";
import { HeroPortrait } from "@/components/hero-portrait";
import { buttonStyles } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import type { HeroInfo } from "@/lib/dota";
import { getHeroes } from "@/lib/heroes";
import { buildReport, lookupMatch, type MatchLookup } from "@/lib/match/data";
import type { Match } from "@/lib/opendota/types";
import { ParsePanel } from "./parse-panel";
import { ReportView } from "./report-view";

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Match ${id}` };
}

export default async function MatchReportPage({ params, searchParams }: PageProps<"/match/[id]">) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, getCurrentUser()]);
  const matchId = Number(id);
  if (!/^\d{6,12}$/.test(id)) notFound();

  let lookup: MatchLookup;
  try {
    lookup = await lookupMatch(matchId);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[match] lookup failed", err);
    lookup = { status: "error", message: "OpenDota couldn't be reached. Try again in a minute." };
  }

  if (lookup.status === "not-found") {
    return (
      <Message
        illustration="/brand/empty-match-not-found.svg"
        title="We couldn't find that match"
        body="Check the match ID. If the game just ended, give it a few minutes and try again."
      />
    );
  }
  if (lookup.status === "error") {
    return <Message title="Match data isn't available right now" body={lookup.message} />;
  }
  if (lookup.status === "turbo") {
    return (
      <Message
        title="Turbo matches aren't supported"
        body="Turbo games play very differently, so comparing them with normal matches would give misleading advice."
      />
    );
  }

  const match = lookup.match;
  const slotParam = Number(Array.isArray(sp.slot) ? sp.slot[0] : sp.slot);
  const slot = match.players.some((pl) => pl.player_slot === slotParam)
    ? slotParam
    : match.players.find((pl) => user && pl.account_id === user.accountId)?.player_slot;

  const heroes = new Map((await getHeroes()).map((h) => [h.id, h]));

  if (slot === undefined) {
    return <PlayerChooser match={match} heroes={heroes} />;
  }

  const report = await buildReport(match, slot);

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 pt-10 sm:px-6">
      <ReportView report={report} heroes={heroes} />
      {!report.parsed ? <ParsePanel matchId={match.match_id} startTime={match.start_time} /> : null}
    </div>
  );
}

function PlayerChooser({ match, heroes }: { match: Match; heroes: Map<number, HeroInfo> }) {
  const teams = [
    { name: "Radiant", color: "text-radiant", players: match.players.filter((p) => p.isRadiant) },
    { name: "Dire", color: "text-dire", players: match.players.filter((p) => !p.isRadiant) },
  ];
  return (
    <div className="mx-auto grid max-w-4xl gap-6 px-4 pt-10 sm:px-6">
      <div className="grid gap-2">
        <h1 className="font-display text-3xl font-bold">Which player were you?</h1>
        <p className="text-muted">
          Pick a player to review match {match.match_id}. {match.radiant_win ? "Radiant" : "Dire"}{" "}
          won.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {teams.map((team) => (
          <section
            key={team.name}
            aria-labelledby={`team-${team.name}`}
            className="grid content-start gap-2"
          >
            <h2 id={`team-${team.name}`} className={`font-display text-lg font-bold ${team.color}`}>
              {team.name}
            </h2>
            <ul className="grid gap-2">
              {team.players.map((pl) => {
                const hero = heroes.get(pl.hero_id);
                return (
                  <li key={pl.player_slot}>
                    <Link
                      href={`/match/${match.match_id}?slot=${pl.player_slot}`}
                      className="grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border bg-surface p-2 transition-colors hover:bg-surface-2"
                    >
                      {hero ? <HeroPortrait hero={hero} decorative /> : <span />}
                      <span className="grid min-w-0">
                        <span className="truncate font-display font-bold">{hero?.name}</span>
                        <span className="truncate text-sm text-muted">
                          {pl.personaname || "Anonymous player"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Message({
  title,
  body,
  illustration,
}: {
  title: string;
  body: string;
  illustration?: string;
}) {
  return (
    <div className="mx-auto grid max-w-2xl justify-items-start gap-4 px-4 pt-16 sm:px-6">
      {illustration ? <MaskedSvg src={illustration} className="h-32 w-48 text-accent" /> : null}
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="max-w-[56ch] text-muted">{body}</p>
      <Link href="/match" className={buttonStyles({ variant: "secondary" })}>
        Review another match
      </Link>
    </div>
  );
}
