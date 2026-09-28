import Link from "next/link";
import { after } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
import { CheckCircle, Hourglass } from "@phosphor-icons/react/ssr";
import { SteamSignIn } from "@/components/steam-sign-in";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { getDb, schema } from "@/lib/db";
import type { HeroInfo } from "@/lib/dota";
import { readReplays, storedSummaries } from "@/lib/players/data";
import {
  GOAL_METRICS,
  goalProgress,
  goalText,
  isGoalMetric,
  type Direction,
  type GoalProgress,
} from "@/lib/players/goals";
import { archiveGoal } from "./goal-actions";
import { GoalForm } from "./goal-form";

/** Replay yang dibaca di latar belakang setiap kali pemilik membuka tab Goals. */
const REPLAYS_ON_VISIT = 3;

export async function GoalsView({
  accountId,
  isOwner,
  signedIn,
  userId,
  heroes,
  recentHeroIds,
}: {
  accountId: number;
  isOwner: boolean;
  signedIn: boolean;
  userId: string | null;
  heroes: Map<number, HeroInfo>;
  recentHeroIds: number[];
}) {
  if (!signedIn) {
    return (
      <div className="grid justify-items-start gap-4 rounded-lg border border-border bg-surface p-5">
        <p>
          Practice goals are saved to your account and checked against your new matches. Sign in to
          set your own.
        </p>
        <SteamSignIn next={`/players/${accountId}?tab=goals`} />
      </div>
    );
  }
  if (!isOwner || !userId) {
    return (
      <p className="rounded-lg border border-border bg-surface p-5">
        Goals are private to each player. Open{" "}
        <Link href="/players" className="text-accent-fg underline-offset-4 hover:underline">
          your own profile
        </Link>{" "}
        to set yours.
      </p>
    );
  }

  const db = await getDb();
  const goals = await db
    .select()
    .from(schema.goals)
    .where(and(eq(schema.goals.userId, userId), isNull(schema.goals.archivedAt)))
    .orderBy(asc(schema.goals.createdAt));

  // Baca statistik replay yang sudah selesai di-parse setelah halaman terkirim.
  after(() => readReplays(accountId, REPLAYS_ON_VISIT).catch(() => 0));

  const earliest = goals.reduce<Date | null>(
    (min, g) => (!min || g.createdAt < min ? g.createdAt : min),
    null,
  );
  const matches = earliest ? await storedSummaries(accountId, earliest) : [];

  const heroOptions = [
    ...recentHeroIds.map((id) => heroes.get(id)).filter((h): h is HeroInfo => Boolean(h)),
    ...[...heroes.values()]
      .filter((h) => !recentHeroIds.includes(h.id))
      .sort((a, b) => a.name.localeCompare(b.name)),
  ].map((h) => ({ id: h.id, name: h.name }));

  return (
    <div className="grid gap-8">
      <p className="max-w-[70ch] text-sm text-muted">
        Set a target and the number of games you want to hit it in. Only matches played after you
        add the goal count, and they don&apos;t need to be in a row.
      </p>

      {goals.length ? (
        <ul className="grid gap-3">
          {goals.map((g) => {
            if (!isGoalMetric(g.metric)) return null;
            const input = {
              metric: g.metric,
              direction: g.direction as Direction,
              target: g.target,
              games: g.games,
              heroId: g.heroId,
              createdAt: g.createdAt,
            };
            const progress = goalProgress(input, matches);
            const hero = g.heroId ? heroes.get(g.heroId) : null;
            return (
              <li key={g.id}>
                <GoalCard
                  id={g.id}
                  title={goalText(input)}
                  heroName={hero?.name ?? null}
                  since={g.createdAt}
                  progress={progress}
                  games={g.games}
                  unit={GOAL_METRICS[g.metric].unit}
                  heroes={heroes}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
          No goals yet. Pick one thing to work on, like dying less or better last hits by minute 10.
        </p>
      )}

      <GoalForm heroes={heroOptions} />
    </div>
  );
}

function GoalCard({
  id,
  title,
  heroName,
  since,
  progress,
  games,
  unit,
  heroes,
}: {
  id: string;
  title: string;
  heroName: string | null;
  since: Date;
  progress: GoalProgress;
  games: number;
  unit: string;
  heroes: Map<number, HeroInfo>;
}) {
  const share = Math.min(1, progress.met / games);
  return (
    <article
      className={cn(
        "grid gap-3 rounded-lg border bg-surface p-4",
        progress.done ? "border-accent-fg" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 className="flex items-center gap-2 font-display text-lg font-bold">
            {progress.done ? (
              <CheckCircle size={20} weight="fill" aria-hidden className="text-accent-fg" />
            ) : null}
            {title}
          </h3>
          <p className="text-xs text-muted">
            {heroName ? `${heroName} only. ` : ""}Since{" "}
            {since.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
        <form action={archiveGoal.bind(null, id)}>
          <Button type="submit" variant="ghost" size="sm">
            {progress.done ? "Clear" : "Remove"}
          </Button>
        </form>
      </div>

      <div className="grid gap-1">
        <div className="flex justify-between text-sm">
          <span>{progress.done ? "Done" : `${progress.met} of ${games}`}</span>
          <span className="text-muted">
            {progress.counted} {progress.counted === 1 ? "game" : "games"} counted
          </span>
        </div>
        <div
          className="h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={games}
          aria-valuenow={progress.met}
          aria-label={title}
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${share * 100}%` }} />
        </div>
      </div>

      {progress.waitingForReplay ? (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Hourglass size={14} aria-hidden />
          {progress.waitingForReplay} newer{" "}
          {progress.waitingForReplay === 1 ? "match is" : "matches are"} waiting for a parsed
          replay.
        </p>
      ) : null}

      {progress.results.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Recent games">
          {progress.results.slice(0, 12).map((r) => (
            <li key={r.matchId}>
              <Link
                href={`/match/${r.matchId}`}
                title={`${heroes.get(r.heroId)?.name ?? "Match"}: ${formatValue(r.value)}${unit}`}
                className={cn(
                  "inline-flex h-7 min-w-10 items-center justify-center rounded-sm border px-1.5 font-mono text-xs tabular-nums",
                  r.met ? "border-accent-fg text-fg" : "border-border text-muted",
                )}
              >
                {formatValue(r.value)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function formatValue(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
