import type { Metadata } from "next";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ChapterLabel } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { bracketFromRankTier, type HeroInfo } from "@/lib/dota";
import { getHeroes } from "@/lib/heroes";
import { loadLivePlan, type LivePlan } from "@/lib/live/data";
import { parseLiveState } from "@/lib/live/types";
import { LiveResults } from "./live-results";
import { LiveSetup } from "./live-setup";

export const metadata: Metadata = {
  title: "Game plan",
  description: "Items against the enemy lineup, your usual build, and when your team is strongest.",
};

export default async function LivePage({ searchParams }: PageProps<"/live">) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);

  // Urutan default sama dengan draft: URL, lalu preferensi profil, lalu rank asli dari OpenDota.
  const state = parseLiveState(params, {
    bracket: user ? user.preferredBracket || bracketFromRankTier(user.rankTier) : 0,
    position: user?.preferredPosition ?? 0,
  });

  let result: LivePlan | null = null;
  let heroes: HeroInfo[] = [];
  try {
    result = await loadLivePlan(state);
    heroes = result.heroes;
  } catch (err) {
    unstable_rethrow(err);
    console.error("[live] failed to build plan", err);
    heroes = await getHeroes().catch(() => []);
  }

  return (
    <div className="mx-auto grid max-w-3xl gap-8 px-4 pt-10 sm:px-6">
      <div>
        <ChapterLabel>Chapter II</ChapterLabel>
        <h1 className="mt-1 font-display text-3xl font-bold">Game plan</h1>
        <p className="mt-2 max-w-[62ch] text-muted">
          Items against this enemy lineup, your usual build, and when your team is strongest. Keep
          it open on your phone or a second screen.{" "}
          <Link href="/draft" className="text-accent-fg underline-offset-4 hover:underline">
            Start from a draft
          </Link>{" "}
          to fill in the heroes for you.
        </p>
      </div>

      {heroes.length ? (
        <Suspense>
          <LiveSetup
            heroes={heroes}
            state={state}
            resolvedPosition={result?.status === "ok" ? result.position : null}
          />
        </Suspense>
      ) : null}

      {!result ? (
        <div role="alert" className="rounded-lg border border-border bg-surface p-6">
          <p className="font-medium">The game plan couldn&apos;t be loaded.</p>
          <p className="mt-1 text-sm text-muted">
            OpenDota might be busy or rate limiting us. Refresh the page in a minute.
          </p>
        </div>
      ) : result.status === "ok" ? (
        <LiveResults
          advice={result.advice}
          plan={result.plan}
          heroName={result.hero.name}
          bracketLabel={result.bracketLabel}
          hasEnemies={state.enemies.length > 0}
          minute={state.minute}
          missingBuild={result.missingBuild}
        />
      ) : null}
    </div>
  );
}
