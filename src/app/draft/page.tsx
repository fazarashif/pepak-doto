import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ChapterLabel } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { bracketFromRankTier, type HeroInfo } from "@/lib/dota";
import { parseIdList, type DraftState } from "@/lib/draft/types";
import { getHeroes } from "@/lib/heroes";
import { DraftBoard } from "./draft-board";

export const metadata: Metadata = { title: "Draft" };

function intParam(value: string | string[] | undefined, min: number, max: number) {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export default async function DraftPage({ searchParams }: PageProps<"/draft">) {
  const [params, user] = await Promise.all([searchParams, getCurrentUser()]);

  let heroes: HeroInfo[] = [];
  let failed = false;
  try {
    heroes = await getHeroes();
  } catch (err) {
    unstable_rethrow(err);
    console.error("[draft] failed to load heroes", err);
    failed = true;
  }

  // Urutan default: URL, lalu preferensi profil, lalu rank asli dari OpenDota.
  const profileBracket = user ? user.preferredBracket || bracketFromRankTier(user.rankTier) : 0;
  const initial: DraftState = {
    allies: parseIdList(params.a, 4),
    enemies: parseIdList(params.e, 5),
    bans: parseIdList(params.b, 16),
    bracket: intParam(params.r, 0, 8) ?? profileBracket,
    position: intParam(params.p, 0, 5) ?? user?.preferredPosition ?? 0,
    poolOnly: params.pool === "1",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <ChapterLabel>Chapter I</ChapterLabel>
      <h1 className="mt-1 font-display text-3xl font-bold">Draft assistant</h1>
      <p className="mt-2 max-w-[62ch] text-muted">
        Add heroes as they get picked and banned. Suggestions update as you go.
      </p>

      {failed ? (
        <div role="alert" className="mt-8 rounded-lg border border-border bg-surface p-6">
          <p className="font-medium">Hero data couldn&apos;t be loaded.</p>
          <p className="mt-1 text-sm text-muted">
            OpenDota might be busy or rate limiting us. Refresh the page in a minute.
          </p>
        </div>
      ) : (
        <Suspense>
          <DraftBoard heroes={heroes} initial={initial} signedIn={Boolean(user)} />
        </Suspense>
      )}
    </div>
  );
}
