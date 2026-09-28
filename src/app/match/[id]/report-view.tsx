import Link from "next/link";
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/ssr";
import { FramedPanel, MarginNote } from "@/components/brand";
import { HeroPortrait } from "@/components/hero-portrait";
import { cn } from "@/lib/cn";
import { formatClock, rankTierLabel, type HeroInfo } from "@/lib/dota";
import type { Grade, MatchReport } from "@/lib/match/analyze";

const STAMP: Record<Grade["letter"], string> = {
  A: "border-accent-fg text-accent-fg",
  B: "border-border-strong text-fg",
  C: "border-border text-muted",
  D: "border-danger text-danger",
};

export function ReportView({
  report,
  heroes,
}: {
  report: MatchReport;
  heroes: Map<number, HeroInfo>;
}) {
  const hero = heroes.get(report.player.heroId);
  const p = report.player;
  const date = new Date(report.startTime * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="grid gap-10">
      <Link
        href="/match"
        className="flex w-fit items-center gap-1.5 text-sm text-muted hover:text-fg"
      >
        <ArrowLeft size={16} aria-hidden />
        All matches
      </Link>

      <header className="grid gap-5 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center">
        {hero ? <HeroPortrait hero={hero} decorative priority /> : null}
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{hero?.name ?? "Unknown hero"}</h1>
            <span
              className={cn(
                "rounded-sm border px-2 py-0.5 text-sm font-bold",
                p.win ? "border-accent-fg text-accent-fg" : "border-border text-muted",
              )}
            >
              {p.win ? "Won" : "Lost"}
            </span>
          </div>
          <p className="text-muted">
            {p.name} on{" "}
            <span className={p.isRadiant ? "text-radiant" : "text-dire"}>
              {p.isRadiant ? "Radiant" : "Dire"}
            </span>
            {p.rankTier ? `, ${rankTierLabel(p.rankTier)}` : ""}
          </p>
          <dl className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-sm tabular-nums">
            <Stat label="KDA" value={`${p.kills}/${p.deaths}/${p.assists}`} />
            <Stat label="LH/DN" value={`${p.lastHits}/${p.denies}`} />
            <Stat label="GPM" value={String(p.gpm)} />
            <Stat label="XPM" value={String(p.xpm)} />
            <Stat label="Duration" value={formatClock(report.duration)} />
          </dl>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>
              Match {report.matchId}, {date}
            </span>
            <ExternalLink href={`https://www.opendota.com/matches/${report.matchId}`}>
              OpenDota
            </ExternalLink>
            <ExternalLink href={`https://stratz.com/matches/${report.matchId}`}>
              STRATZ
            </ExternalLink>
          </p>
        </div>
      </header>

      {report.notes.length ? (
        <ul className="grid gap-1 text-sm text-muted">
          {report.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      <FramedPanel as="section" tab="Notes" className="p-6 md:p-8">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            <h2 className="font-display text-2xl font-bold">What to work on</h2>
            {report.improvements.length ? (
              <ol className="grid gap-5">
                {report.improvements.map((imp) => (
                  <li key={imp.title} className="grid gap-1.5">
                    <h3 className="font-display text-lg font-bold">{imp.title}</h3>
                    <p className="text-sm leading-relaxed">{imp.detail}</p>
                    <MarginNote className="text-sm">{imp.tip}</MarginNote>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">
                Nothing stood out as a clear weakness in this match.
              </p>
            )}
          </div>
          <div className="grid content-start gap-3">
            <h2 className="font-display text-xl font-bold">What went well</h2>
            {report.strengths.length ? (
              <ul className="grid gap-2 text-sm leading-relaxed">
                {report.strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No standout numbers this time.</p>
            )}
          </div>
        </div>
      </FramedPanel>

      {report.grades.length ? (
        <section aria-labelledby="grades" className="grid gap-4">
          <h2 id="grades" className="font-display text-xl font-bold">
            Compared with players on {hero?.name ?? "this hero"}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {report.grades.map((g) => (
              <li
                key={g.key}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 rounded-lg border border-border bg-surface p-4"
              >
                <span
                  aria-label={`Grade ${g.letter}`}
                  className={cn(
                    "grid size-14 -rotate-3 place-items-center rounded-sm border-2 font-display-sc text-3xl font-bold",
                    STAMP[g.letter],
                  )}
                >
                  {g.letter}
                </span>
                <div className="grid content-start gap-1">
                  <h3 className="font-display font-bold">{g.label}</h3>
                  <p className="text-sm text-muted">{g.detail}</p>
                  {!g.relevant ? (
                    <p className="text-xs text-muted italic">Matters less for supports.</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.laning || report.deaths ? (
        <div className="grid gap-4 md:grid-cols-2">
          {report.laning ? (
            <DetailCard title="Laning">
              <dl className="grid grid-cols-2 gap-3">
                <Figure label="Lane" value={report.laning.laneLabel} />
                <Figure
                  label="Last hits at 10 min"
                  value={String(report.laning.lh10)}
                  hint={report.laning.target ? `rough target ${report.laning.target}` : undefined}
                />
                <Figure label="Denies at 10 min" value={String(report.laning.dn10)} />
                {report.laning.efficiency !== null ? (
                  <Figure label="Lane efficiency" value={`${report.laning.efficiency}%`} />
                ) : null}
                {report.laning.goldDiff10 !== null ? (
                  <Figure
                    label="Lane gold at 10 min"
                    value={`${report.laning.goldDiff10 >= 0 ? "+" : ""}${report.laning.goldDiff10.toLocaleString("en-US")}`}
                    hint="your lane vs theirs"
                  />
                ) : null}
              </dl>
            </DetailCard>
          ) : null}

          {report.deaths ? (
            <DetailCard title="Deaths">
              <dl className="grid grid-cols-2 gap-3">
                {report.deaths.byPhase.map((ph) => (
                  <Figure key={ph.label} label={ph.label} value={String(ph.count)} />
                ))}
                <Figure label="Time spent dead" value={formatClock(report.deaths.timeDead)} />
                <Figure label="Gold lost" value={report.deaths.goldLost.toLocaleString("en-US")} />
              </dl>
              {report.deaths.topKillers.length ? (
                <p className="text-sm text-muted">
                  Killed most by{" "}
                  {report.deaths.topKillers
                    .map((k) => `${heroes.get(k.heroId)?.name ?? "?"} (${k.count})`)
                    .join(", ")}
                  .
                </p>
              ) : null}
            </DetailCard>
          ) : null}
        </div>
      ) : null}

      {report.itemTimings.length ? (
        <section aria-labelledby="timings" className="grid gap-4">
          <h2 id="timings" className="font-display text-xl font-bold">
            Core item timings
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {report.itemTimings.map((t) => (
              <li
                key={t.item.key}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)] items-center gap-3 rounded-lg border border-border bg-surface p-3"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.item.img} alt="" width={88} height={64} className="w-14 rounded-md" />
                <div className="grid gap-0.5 text-sm">
                  <p>
                    <span className="font-display font-bold">{t.item.name}</span>{" "}
                    <span className="font-mono text-muted tabular-nums">
                      at {formatClock(t.time)}
                    </span>
                  </p>
                  <p className="text-muted">
                    {t.yourWinRate === null
                      ? `Later than most players who build it. Those who had it ${t.bestBucket} won ${Math.round(t.bestWinRate * 100)}%.`
                      : t.bestWinRate - t.yourWinRate < 0.01
                        ? `Players who had it ${t.yourBucket} won ${Math.round(t.yourWinRate * 100)}%. You were on time.`
                        : `Players who had it ${t.yourBucket} won ${Math.round(t.yourWinRate * 100)}%, ${t.bestBucket} won ${Math.round(t.bestWinRate * 100)}%.`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.vision ? (
        <DetailCard title="Vision">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Figure label="Observer wards" value={String(report.vision.observers)} />
            <Figure label="Sentry wards" value={String(report.vision.sentries)} />
            <Figure label="Enemy wards removed" value={String(report.vision.dewards)} />
            <Figure label="Observers per 10 min" value={report.vision.observersPer10.toFixed(1)} />
          </dl>
        </DetailCard>
      ) : null}

      {report.items.length ? (
        <section aria-labelledby="final-items" className="grid gap-3">
          <h2 id="final-items" className="font-display text-xl font-bold">
            Final items
          </h2>
          <ul className="flex flex-wrap gap-2">
            {report.items.map((item, i) => (
              <li key={`${item.key}-${i}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.img}
                  alt={item.name}
                  title={item.name}
                  width={88}
                  height={64}
                  className="h-12 w-auto rounded-md"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="font-sans text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-mono text-lg tabular-nums">{value}</dd>
      {hint ? <dd className="text-xs text-muted">{hint}</dd> : null}
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-4 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-1 text-accent-fg underline-offset-4 hover:underline"
    >
      {children}
      <ArrowSquareOut size={14} aria-hidden />
    </a>
  );
}
