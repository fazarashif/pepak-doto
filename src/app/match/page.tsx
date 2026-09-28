import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { ChapterLabel, MaskedSvg } from "@/components/brand";
import { HeroPortrait } from "@/components/hero-portrait";
import { getCurrentUser } from "@/lib/auth/session";
import { formatClock, type HeroInfo } from "@/lib/dota";
import { getHeroes } from "@/lib/heroes";
import { TURBO_GAME_MODE } from "@/lib/match/analyze";
import { opendota } from "@/lib/opendota/client";
import type { RecentMatch } from "@/lib/opendota/types";
import { MatchIdForm } from "./match-id-form";

export const metadata: Metadata = { title: "Match review" };

function timeAgo(unixSeconds: number) {
  const hours = Math.round((Date.now() / 1000 - unixSeconds) / 3600);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

export default async function MatchPage() {
  const user = await getCurrentUser();

  let recent: RecentMatch[] | null = null;
  let heroes = new Map<number, HeroInfo>();
  let recentFailed = false;
  if (user) {
    try {
      const [matches, list] = await Promise.all([
        opendota.recentMatches(user.accountId),
        getHeroes(),
      ]);
      recent = matches.filter((m) => m.game_mode !== TURBO_GAME_MODE).slice(0, 10);
      heroes = new Map(list.map((h) => [h.id, h]));
    } catch (err) {
      unstable_rethrow(err);
      console.error("[match] recent matches failed", err);
      recentFailed = true;
    }
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-10 px-4 pt-10 sm:px-6">
      <div className="grid gap-2">
        <ChapterLabel>Chapter III</ChapterLabel>
        <h1 className="font-display text-3xl font-bold">Match review</h1>
        <p className="max-w-[60ch] text-muted">
          See how you did compared with other players on the same hero, and the few things most
          worth fixing. Turbo matches aren&apos;t supported.
        </p>
      </div>

      <MatchIdForm />

      {user ? (
        <section aria-labelledby="recent" className="grid gap-4">
          <h2 id="recent" className="font-display text-xl font-bold">
            Your recent matches
          </h2>
          {recentFailed ? (
            <p role="alert" className="text-sm text-muted">
              Your recent matches couldn&apos;t be loaded. OpenDota might be busy, so try again in a
              minute.
            </p>
          ) : recent && recent.length ? (
            <ul className="grid gap-2">
              {recent.map((m) => {
                const hero = heroes.get(m.hero_id);
                const won = m.player_slot < 128 === m.radiant_win;
                return (
                  <li key={m.match_id}>
                    <Link
                      href={`/match/${m.match_id}?slot=${m.player_slot}`}
                      className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-border bg-surface p-2 pr-4 transition-colors hover:bg-surface-2"
                    >
                      {hero ? <HeroPortrait hero={hero} decorative /> : <span />}
                      <span className="grid min-w-0 gap-0.5">
                        <span className="truncate font-display font-bold">
                          {hero?.name ?? "Unknown hero"}
                        </span>
                        <span className="font-mono text-xs text-muted tabular-nums">
                          {m.kills}/{m.deaths}/{m.assists} · {formatClock(m.duration)} ·{" "}
                          {timeAgo(m.start_time)}
                        </span>
                      </span>
                      <span
                        className={
                          won
                            ? "rounded-sm border border-accent-fg px-2 py-0.5 text-xs font-bold text-accent-fg"
                            : "rounded-sm border border-border px-2 py-0.5 text-xs text-muted"
                        }
                      >
                        {won ? "Won" : "Lost"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="batik grid justify-items-start gap-3 overflow-hidden rounded-lg border border-border p-6">
              <MaskedSvg src="/brand/empty-match-private.svg" className="h-32 w-48 text-accent" />
              <p className="max-w-[56ch] text-sm text-muted">
                We couldn&apos;t find any recent matches for your account. If you&apos;ve been
                playing, your match data is probably private. Turn on{" "}
                <span className="text-fg">Expose Public Match Data</span> in the Dota 2 settings,
                and new matches will show up here after that.
              </p>
            </div>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted">
          <Link
            href="/signin?next=/match"
            className="text-accent-fg underline-offset-4 hover:underline"
          >
            Sign in
          </Link>{" "}
          to pick from your recent matches instead of pasting an ID.
        </p>
      )}
    </div>
  );
}
