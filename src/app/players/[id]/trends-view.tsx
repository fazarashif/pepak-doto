import Link from "next/link";
import { MaskedSvg } from "@/components/brand";
import { HeroPortrait } from "@/components/hero-portrait";
import { cn } from "@/lib/cn";
import { ordinal, pct, type HeroInfo } from "@/lib/dota";
import type { PlayerLookup } from "@/lib/players/data";
import { PCT_METRICS, type PctMetric } from "@/lib/players/summary";
import { buildTrends, METRIC_LABEL, type Bucket, type Trends } from "@/lib/players/trends";
import { storedAsResult, storedTrendSummary, trendKey } from "@/lib/llm/narratives";
import { TrendCoach } from "./trend-coach";

type OkPlayer = Extract<PlayerLookup, { status: "ok" }>;

export async function TrendsView({
  player,
  heroes,
  size,
  signedIn,
  isOwner,
}: {
  player: OkPlayer;
  heroes: Map<number, HeroInfo>;
  size: number;
  signedIn: boolean;
  isOwner: boolean;
}) {
  const names = new Map([...heroes.values()].map((h) => [h.id, h.name]));
  const t = buildTrends(player.summaries, names);
  const winRate = t.games ? t.wins / t.games : 0;
  const summary = storedAsResult(
    await storedTrendSummary(trendKey(player.accountId, player.summaries, size)),
  );

  return (
    <div className="grid gap-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          Last {t.games} matches, Turbo and abandoned games left out. Percentiles compare each game
          with other players on the same hero.
        </p>
        <div className="flex gap-1 rounded-full border border-border p-1 text-sm" role="group">
          {[20, 50].map((n) => (
            <Link
              key={n}
              href={`/players/${player.accountId}?tab=trends${n === 20 ? "&n=20" : ""}`}
              scroll={false}
              aria-current={size === n ? "true" : undefined}
              className={cn(
                "rounded-full px-3 py-1",
                size === n ? "bg-accent text-on-accent" : "text-muted hover:text-fg",
              )}
            >
              {n} games
            </Link>
          ))}
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Win rate" value={pct(winRate, 0)} detail={`${t.wins}–${t.games - t.wins}`} />
        <Stat
          label="Average KDA"
          value={`${t.avgKills.toFixed(1)} / ${t.avgDeaths.toFixed(1)} / ${t.avgAssists.toFixed(1)}`}
        />
        <Stat label="Heroes played" value={String(t.byHero.length)} />
        <Stat
          label="With replay data"
          value={String(player.summaries.filter((s) => s.parsed).length)}
          detail={
            player.registered
              ? "New matches are sent for parsing daily"
              : "Sign in to get your matches parsed automatically"
          }
        />
      </dl>

      <TrendCoach
        key={size}
        accountId={player.accountId}
        size={size}
        initial={summary}
        signedIn={signedIn}
        isOwner={isOwner}
      />

      {t.patterns.length ? (
        <section aria-labelledby="patterns" className="grid gap-3">
          <h2 id="patterns" className="font-display text-2xl font-bold">
            Patterns
          </h2>
          <ul className="grid gap-2">
            {t.patterns.map((p) => (
              <li
                key={p.text}
                className="flex items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <MaskedSvg
                  src="/brand/ornament-margin-note.svg"
                  className={cn(
                    "mt-1.5 size-3 shrink-0",
                    p.tone === "good" ? "text-accent" : "text-danger",
                  )}
                />
                <span>{p.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="percentiles" className="grid gap-3">
        <h2 id="percentiles" className="font-display text-2xl font-bold">
          Compared with other players on the same heroes
        </h2>
        <p className="text-sm text-muted">
          Each dot is one match, oldest on the left. The line is the average of the last 5. Above
          the dashed line means better than half of the players.
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PCT_METRICS.map((metric) =>
            t.series[metric].length ? (
              <li key={metric}>
                <MetricChart metric={metric} trends={t} />
              </li>
            ) : null,
          )}
        </ul>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="by-hero" className="grid content-start gap-3">
          <h2 id="by-hero" className="font-display text-xl font-bold">
            By hero
          </h2>
          <ul className="grid gap-2">
            {t.byHero.slice(0, 8).map((b) => {
              const hero = heroes.get(b.heroId);
              return (
                <li
                  key={b.heroId}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3"
                >
                  {hero ? <HeroPortrait hero={hero} decorative /> : <span />}
                  <WinBar bucket={b} />
                </li>
              );
            })}
          </ul>
        </section>
        <div className="grid content-start gap-8">
          <BucketList
            title="By role"
            buckets={t.byRole}
            note="Guessed from last hits when there's no replay."
          />
          <BucketList title="By game length" buckets={t.byDuration} />
          <BucketList title="Solo or party" buckets={t.byParty} />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="grid content-start gap-0.5 rounded-lg border border-border bg-surface p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-lg tabular-nums">{value}</dd>
      {detail ? <dd className="text-xs text-muted">{detail}</dd> : null}
    </div>
  );
}

function BucketList({ title, buckets, note }: { title: string; buckets: Bucket[]; note?: string }) {
  if (!buckets.length) return null;
  return (
    <section className="grid gap-2">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <ul className="grid gap-2">
        {buckets.map((b) => (
          <li key={b.key}>
            <WinBar bucket={b} />
          </li>
        ))}
      </ul>
      {note ? <p className="text-xs text-muted">{note}</p> : null}
    </section>
  );
}

function WinBar({ bucket }: { bucket: Bucket }) {
  const rate = bucket.games ? bucket.wins / bucket.games : 0;
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="truncate">{bucket.label}</span>
        <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
          {pct(rate, 0)} of {bucket.games}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div
          className={cn("h-full rounded-full", rate >= 0.5 ? "bg-accent" : "bg-danger/70")}
          style={{ width: `${Math.max(rate * 100, 2)}%` }}
        />
      </div>
    </div>
  );
}

const W = 240;
const H = 90;
const PAD = 6;

function MetricChart({ metric, trends }: { metric: PctMetric; trends: Trends }) {
  const points = trends.series[metric];
  const avg = trends.avgPct[metric] ?? 0;
  const x = (i: number) =>
    PAD + (points.length > 1 ? (i / (points.length - 1)) * (W - 2 * PAD) : 0);
  const y = (v: number) => PAD + (1 - v) * (H - 2 * PAD);
  const line = points
    .map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.rolling).toFixed(1)}`)
    .join(" ");
  const last = points.at(-1)?.rolling ?? avg;

  return (
    <figure className="grid gap-2 rounded-lg border border-border bg-surface p-4">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{METRIC_LABEL[metric]}</span>
        <span className="font-mono text-sm tabular-nums">
          {ordinal(Math.round(avg * 100))}
          <span className="text-xs text-muted"> avg</span>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${METRIC_LABEL[metric]}: average percentile ${Math.round(avg * 100)}, last 5 games ${Math.round(last * 100)}.`}
        className="w-full"
      >
        <line
          x1={PAD}
          x2={W - PAD}
          y1={y(0.5)}
          y2={y(0.5)}
          className="stroke-border-strong"
          strokeDasharray="3 3"
        />
        {points.map((p, i) => (
          <circle key={p.matchId} cx={x(i)} cy={y(p.value)} r={2} className="fill-muted/60" />
        ))}
        <path d={line} className="fill-none stroke-accent" strokeWidth={2} />
      </svg>
    </figure>
  );
}
