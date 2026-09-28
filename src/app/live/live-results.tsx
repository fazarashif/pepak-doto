import { Lightning, ShieldSlash } from "@phosphor-icons/react/ssr";
import { FramedPanel, MarginNote, MaskedSvg } from "@/components/brand";
import { PowerCurve } from "@/components/power-curve";
import { cn } from "@/lib/cn";
import { pct } from "@/lib/dota";
import {
  phaseFor,
  type Advice,
  type BuildEntry,
  type ItemInfo,
  type Phase,
  type SituationalEntry,
} from "@/lib/items/advisor";
import type { GamePlan } from "@/lib/plan/game-plan";
import { OwnedToggle } from "./owned-toggle";

const PHASE_LABEL: Record<Phase, string> = {
  early: "Laning (to minute 12)",
  mid: "Mid game (12 to 25)",
  late: "Late game (25+)",
};

const SITUATIONAL_SHOWN = 6;

export function LiveResults({
  advice,
  plan,
  heroName,
  bracketLabel,
  hasEnemies,
  minute,
  missingBuild,
}: {
  advice: Advice;
  plan: GamePlan;
  heroName: string;
  bracketLabel: string;
  hasEnemies: boolean;
  minute: number | null;
  missingBuild: boolean;
}) {
  const current = minute !== null ? phaseFor(minute) : null;
  // Item yang sudah dibeli tetap ditampilkan di bawah supaya bisa dibatalkan.
  const situational = [
    ...advice.situational.filter((s) => !s.owned).slice(0, SITUATIONAL_SHOWN),
    ...advice.situational.filter((s) => s.owned),
  ];

  return (
    <div className="grid gap-10">
      <FramedPanel as="section" tab="Counters" className="p-5 sm:p-6">
        <div className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-display text-2xl font-bold">Items for this game</h2>
            <p className="text-sm text-muted">
              {hasEnemies
                ? `Picked for a ${roleLabel(advice.role)} against this enemy lineup.`
                : "Add enemy heroes to see which items counter them."}
            </p>
          </div>
          {situational.length ? (
            <ol className="grid gap-4">
              {situational.map((s) => (
                <SituationalItem key={s.item.key} entry={s} />
              ))}
            </ol>
          ) : hasEnemies ? (
            <p className="text-sm">
              Nothing in this lineup needs a special answer. Stick to your usual build below.
            </p>
          ) : null}
        </div>
      </FramedPanel>

      <section aria-labelledby="build" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="build" className="font-display text-2xl font-bold">
            Usual {heroName} build
          </h2>
          <p className="text-sm text-muted">
            What players on this hero and position buy in {bracketLabel}, with the usual timing.
          </p>
        </div>
        {missingBuild ? (
          <p className="rounded-md bg-surface-2 px-4 py-3 text-sm">
            Build data for this hero isn&apos;t available yet. It&apos;s refreshed once a day, so
            check back later or try another rank.
          </p>
        ) : (
          <div className="grid gap-4">
            {advice.starting.length || advice.boots.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {advice.starting.length ? (
                  <ItemGroup title="Starting items">
                    <ul className="flex flex-wrap gap-2">
                      {advice.starting.map((s) => (
                        <li key={s.item.key} className="relative" title={s.item.name}>
                          <ItemIcon item={s.item} className="w-12" />
                          {s.count > 1 ? (
                            <span className="absolute right-0.5 bottom-0.5 rounded-sm bg-bg/85 px-1 font-mono text-xs tabular-nums">
                              ×{s.count}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </ItemGroup>
                ) : null}
                {advice.boots.length ? (
                  <ItemGroup title="Boots">
                    <ul className="grid gap-2">
                      {advice.boots.slice(0, 3).map((b) => (
                        <li key={b.item.key} className="flex items-center gap-3">
                          <ItemIcon item={b.item} className="w-12" />
                          <div className="min-w-0 text-sm">
                            <p className="font-medium">{b.item.name}</p>
                            <p className="text-muted">
                              {pct(b.share, 0)} of players, around minute {b.medianMinute}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ItemGroup>
                ) : null}
              </div>
            ) : null}
            {(Object.keys(PHASE_LABEL) as Phase[]).map((phase) =>
              advice.phases[phase].length ? (
                <ItemGroup key={phase} title={PHASE_LABEL[phase]} highlight={current === phase}>
                  <ul className="grid gap-3">
                    {advice.phases[phase].map((entry) => (
                      <BuildItem key={entry.item.key} entry={entry} />
                    ))}
                  </ul>
                </ItemGroup>
              ) : null,
            )}
          </div>
        )}
      </section>

      <section aria-labelledby="plan" className="grid gap-4">
        <h2 id="plan" className="font-display text-2xl font-bold">
          Game plan
        </h2>
        {hasEnemies ? (
          <>
            <MarginNote className="text-lg not-italic">{plan.summary}</MarginNote>
            {plan.stateTip ? <p className="text-sm">{plan.stateTip}</p> : null}
            <PowerCurve
              label={`How each lineup does by game length. ${plan.summary}`}
              note="Win rate compared with each hero's average, by game length in minutes."
              series={[
                {
                  label: "Your team",
                  variant: "accent",
                  points: plan.curve.map((p) => ({ minute: p.minute, value: p.allies })),
                },
                {
                  label: "Enemy team",
                  variant: "muted",
                  points: plan.curve.map((p) => ({ minute: p.minute, value: p.enemies })),
                },
              ]}
            />
            {advice.enemyDamage ? <DamageBar mix={advice.enemyDamage} /> : null}
          </>
        ) : (
          <p className="text-sm text-muted">
            Add the enemy heroes to compare when each team is strongest.
          </p>
        )}
      </section>

      {plan.dangers.length ? (
        <section aria-labelledby="watch" className="grid gap-4">
          <h2 id="watch" className="font-display text-2xl font-bold">
            Watch out for
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {plan.dangers.map((d) => (
              <li key={d.heroId} className="rounded-lg border border-border bg-surface p-4">
                <p className="font-display font-bold">{d.heroName}</p>
                <ul className="mt-1 grid gap-1 text-sm">
                  {d.abilities.map((a) => (
                    <li key={a.key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <Lightning size={14} aria-hidden className="text-accent-fg" />
                      {a.name}
                      {a.bkbPierce ? (
                        <span className="inline-flex items-center gap-1 rounded-sm border border-danger px-1.5 text-xs text-danger">
                          <ShieldSlash size={12} aria-hidden />
                          Goes through BKB
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function roleLabel(role: Advice["role"]) {
  return role === "core" ? "core" : role === "offlane" ? "offlaner" : "support";
}

function ItemIcon({ item, className }: { item: ItemInfo; className?: string }) {
  if (!item.img)
    return <span className={cn("aspect-[88/64] rounded-md bg-surface-2", className)} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.img}
      alt={item.name}
      width={88}
      height={64}
      loading="lazy"
      className={cn("aspect-[88/64] rounded-md bg-surface-2", className)}
    />
  );
}

function ItemGroup({
  title,
  highlight = false,
  children,
}: {
  title: string;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid content-start gap-3 rounded-lg border bg-surface p-4",
        highlight ? "border-accent-fg" : "border-border",
      )}
    >
      <h3 className="flex items-center gap-2 font-display-sc text-sm font-bold">
        {title}
        {highlight ? (
          <span className="rounded-sm bg-accent px-1.5 font-sans text-xs font-medium text-on-accent">
            Now
          </span>
        ) : null}
      </h3>
      {children}
    </div>
  );
}

function SituationalItem({ entry }: { entry: SituationalEntry }) {
  return (
    <li
      className={cn(
        "grid grid-cols-[3.5rem_minmax(0,1fr)] gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0",
        entry.owned && "opacity-60",
      )}
    >
      <ItemIcon item={entry.item} className="w-14" />
      <div className="grid gap-1.5">
        <p className="font-display font-bold">
          {entry.item.name}{" "}
          <span className="font-mono text-xs font-normal text-muted tabular-nums">
            {entry.item.cost.toLocaleString("en-US")}
          </span>
        </p>
        <ul className="grid gap-1">
          {entry.reasons.map((r) => (
            <li key={r} className="flex items-start gap-1.5 text-sm">
              <MaskedSvg
                src="/brand/ornament-margin-note.svg"
                className="mt-1.5 size-2.5 shrink-0 text-accent"
              />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <OwnedToggle itemId={entry.item.id} owned={entry.owned} name={entry.item.name} />
          {entry.inBuild ? (
            <span className="text-xs text-muted">Already part of the usual build.</span>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function BuildItem({ entry }: { entry: BuildEntry }) {
  const timing =
    entry.onTimeWinRate !== null && entry.lateWinRate !== null
      ? `${pct(entry.onTimeWinRate, 0)} win rate by minute ${entry.medianMinute}, ${pct(entry.lateWinRate, 0)} later`
      : `${pct(entry.winRate, 0)} win rate`;
  return (
    <li
      className={cn(
        "grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3",
        entry.owned && "opacity-60",
      )}
    >
      <ItemIcon item={entry.item} className="w-14" />
      <div className="min-w-0 text-sm">
        <p className="font-medium">
          {entry.item.name}{" "}
          <span className="font-mono text-xs text-muted tabular-nums">
            ~{entry.medianMinute} min
          </span>
        </p>
        <p className="text-muted">
          {pct(entry.share, 0)} of players. {timing}.
        </p>
      </div>
      <OwnedToggle itemId={entry.item.id} owned={entry.owned} name={entry.item.name} />
    </li>
  );
}

function DamageBar({ mix }: { mix: NonNullable<Advice["enemyDamage"]> }) {
  const parts = [
    { label: "Physical", value: mix.physical, className: "bg-fg/70" },
    { label: "Magic", value: mix.magical, className: "bg-accent" },
    { label: "Pure", value: mix.pure, className: "bg-danger" },
  ].filter((p) => p.value >= 0.01);
  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Enemy damage</p>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {parts.map((p) => (
          <div key={p.label} className={p.className} style={{ width: `${p.value * 100}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", p.className)} aria-hidden />
            {p.label} {pct(p.value, 0)}
          </li>
        ))}
      </ul>
    </div>
  );
}
