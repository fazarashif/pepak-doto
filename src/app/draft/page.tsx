import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ChapterLabel } from "@/components/brand";
import { getCurrentUser } from "@/lib/auth/session";
import { bracketFromRankTier, type HeroInfo } from "@/lib/dota";
import { getPositionShares } from "@/lib/draft/data";
import { bestOpenPosition } from "@/lib/draft/positions";
import {
  EMPTY_TEAM,
  parseIdList,
  parseRound,
  parseSlotList,
  type DraftState,
} from "@/lib/draft/types";
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
  let shares: [number, number[]][] = [];
  let failed = false;
  try {
    heroes = await getHeroes();
    shares = await getPositionShares(heroes);
  } catch (err) {
    unstable_rethrow(err);
    console.error("[draft] failed to load heroes", err);
    failed = true;
  }

  // Urutan default: URL, lalu preferensi profil, lalu rank asli dari OpenDota.
  const profileBracket = user ? user.preferredBracket || bracketFromRankTier(user.rankTier) : 0;
  const position = intParam(params.p, 0, 5) ?? user?.preferredPosition ?? 0;
  const enemies = parseSlotList(params.e, 5);
  const initial: DraftState = {
    allies: placeAllies(parseSlotList(params.a, 5), new Map(shares), position),
    enemies: enemies.map((s) => s.heroId),
    enemyPos: enemies.map((s) => s.position),
    bans: parseIdList(params.b, 16),
    bracket: intParam(params.r, 0, 8) ?? profileBracket,
    position,
    round: parseRound(params.rd),
    poolOnly: params.pool === "1",
  };
  // Hero yang sudah ada di tim sendiri tidak boleh muncul lagi di daftar lain.
  const allyIds = new Set(initial.allies.filter(Boolean));
  initial.enemies = initial.enemies.filter((id) => !allyIds.has(id));
  initial.enemyPos = enemies.filter((s) => !allyIds.has(s.heroId)).map((s) => s.position);
  initial.bans = initial.bans.filter((id) => !allyIds.has(id) && !initial.enemies.includes(id));

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
          <DraftBoard heroes={heroes} shares={shares} initial={initial} signedIn={Boolean(user)} />
        </Suspense>
      )}
    </div>
  );
}

/**
 * Hero tim sendiri dari URL ke slot posisi. Link lama hanya berisi daftar hero tanpa posisi
 * (dan tanpa hero user), jadi posisi user dibiarkan kosong dan sisanya ditebak.
 */
function placeAllies(
  slots: { heroId: number; position: number }[],
  shares: Map<number, number[]>,
  userPosition: number,
) {
  const team = [...EMPTY_TEAM];
  for (const s of slots) if (s.position) team[s.position - 1] = s.heroId;
  for (const s of slots) {
    if (s.position) continue;
    const open = [1, 2, 3, 4, 5].filter((p) => !team[p - 1] && p !== userPosition);
    const pos = bestOpenPosition(s.heroId, open, shares);
    if (pos) team[pos - 1] = s.heroId;
  }
  return team;
}
