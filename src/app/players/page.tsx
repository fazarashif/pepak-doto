import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/ssr";
import { ChapterLabel } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { PlayerSearch } from "./player-search";

export const metadata: Metadata = {
  title: "Players",
  description: "Trends, hero pool and ward maps for any Dota 2 account with public match data.",
};

export default async function PlayersPage() {
  const user = await getCurrentUser();

  return (
    <div className="mx-auto grid max-w-2xl gap-8 px-4 pt-10 sm:px-6">
      <div>
        <ChapterLabel>Chapter IV</ChapterLabel>
        <h1 className="mt-1 font-display text-3xl font-bold">Player profiles</h1>
        <p className="mt-2 max-w-[60ch] text-muted">
          How a player is trending over their recent games, which heroes they do well on, and where
          they place wards. Works for any account with public match data.
        </p>
      </div>

      {user ? (
        <Link
          href={`/players/${user.accountId}`}
          className="flex w-fit items-center gap-1.5 font-medium text-accent-fg underline-offset-4 hover:underline"
        >
          Open your own profile
          <ArrowRight size={16} aria-hidden />
        </Link>
      ) : null}

      <PlayerSearch />
    </div>
  );
}
