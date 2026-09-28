"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Plus, Warning, X } from "@phosphor-icons/react";
import { FramedPanel, MaskedSvg, Ribbon } from "@/components/brand";
import { HeroPicker } from "@/components/hero-picker";
import { HeroPortrait } from "@/components/hero-portrait";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BRACKETS, POSITIONS, type HeroInfo } from "@/lib/dota";
import type { Reason } from "@/lib/draft/engine";
import { toSearchParams, type DraftResponse, type DraftState } from "@/lib/draft/types";

type Target = "allies" | "enemies" | "bans";

const LIMITS: Record<Target, number> = { allies: 4, enemies: 5, bans: 16 };
const TARGET_LABEL: Record<Target, string> = {
  allies: "your team",
  enemies: "the enemy team",
  bans: "bans",
};

const selectClass =
  "h-11 w-full rounded-md border border-border bg-surface px-3 text-base focus:border-accent-fg focus:outline-none sm:text-sm";

interface Props {
  heroes: HeroInfo[];
  initial: DraftState;
  signedIn: boolean;
}

export function DraftBoard({ heroes, initial, signedIn }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<DraftState>(initial);
  const [target, setTarget] = useState<Target>("enemies");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const suggestions = useDraftSuggestions(state);

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const taken = useMemo(
    () => new Set([...state.allies, ...state.enemies, ...state.bans]),
    [state.allies, state.enemies, state.bans],
  );
  const targetFull = state[target].length >= LIMITS[target];

  // Simpan draft di URL supaya aman saat refresh dan bisa dibagikan.
  useEffect(() => {
    router.replace(`${pathname}?${toSearchParams(state)}`, { scroll: false });
  }, [state, pathname, router]);

  function add(hero: HeroInfo) {
    setState((s) => {
      if (s.allies.includes(hero.id) || s.enemies.includes(hero.id) || s.bans.includes(hero.id)) {
        return s;
      }
      if (s[target].length >= LIMITS[target]) return s;
      return { ...s, [target]: [...s[target], hero.id] };
    });
    dialogRef.current?.close();
  }

  function remove(group: Target, id: number) {
    setState((s) => ({ ...s, [group]: s[group].filter((x) => x !== id) }));
  }

  function choose(group: Target) {
    setTarget(group);
    // Di layar kecil, pemilih hero dibuka sebagai dialog.
    if (!window.matchMedia("(min-width: 1024px)").matches) dialogRef.current?.showModal();
  }

  const picker = (
    <div className="grid gap-3">
      <TargetSwitch value={target} onChange={setTarget} counts={state} />
      {targetFull ? (
        <p role="status" className="text-sm text-muted">
          {target === "bans" ? "The ban list" : `The slots for ${TARGET_LABEL[target]}`} are full.
          Remove a hero or add to another group.
        </p>
      ) : null}
      <HeroPicker heroes={heroes} disabledIds={taken} onPick={add} />
    </div>
  );

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start">
      <div className="grid gap-6">
        <Settings
          state={state}
          signedIn={signedIn}
          onChange={(patch) => setState((s) => ({ ...s, ...patch }))}
        />

        <section
          aria-label="Draft"
          className="grid gap-5 rounded-lg border border-border bg-surface p-4 sm:p-5"
        >
          <TeamRow
            label="Your team"
            group="allies"
            ids={state.allies}
            byId={byId}
            active={target === "allies"}
            onChoose={choose}
            onRemove={remove}
            withYou
          />
          <TeamRow
            label="Enemy team"
            group="enemies"
            ids={state.enemies}
            byId={byId}
            active={target === "enemies"}
            onChoose={choose}
            onRemove={remove}
          />
          <BanRow
            ids={state.bans}
            byId={byId}
            active={target === "bans"}
            onChoose={choose}
            onRemove={remove}
          />
          {taken.size ? (
            <Button
              variant="ghost"
              size="sm"
              className="w-fit"
              onClick={() => setState((s) => ({ ...s, allies: [], enemies: [], bans: [] }))}
            >
              Clear draft
            </Button>
          ) : null}
        </section>

        <div className="hidden lg:block">{picker}</div>
      </div>

      <Suggestions
        {...suggestions}
        byId={byId}
        signedIn={signedIn}
        hasEnemies={state.enemies.length > 0}
      />

      <dialog
        ref={dialogRef}
        aria-label={`Add a hero to ${TARGET_LABEL[target]}`}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-4 text-fg backdrop:bg-black/60"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-display text-lg font-bold">Add to {TARGET_LABEL[target]}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={22} aria-hidden />
          </Button>
        </div>
        {picker}
      </dialog>
    </div>
  );
}

function useDraftSuggestions(state: DraftState) {
  const [result, setResult] = useState<{
    status: "loading" | "ready" | "error";
    data?: DraftResponse;
    error?: string;
  }>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const body = JSON.stringify(state);

  useEffect(() => {
    const controller = new AbortController();
    // Tunggu sebentar supaya beberapa klik cepat hanya memicu satu request.
    const timer = setTimeout(async () => {
      setResult((r) => ({ ...r, status: "loading" }));
      try {
        const res = await fetch("/api/draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
        setResult({ status: "ready", data: json as DraftResponse });
      } catch (err) {
        if (controller.signal.aborted) return;
        setResult((r) => ({
          ...r,
          status: "error",
          error: err instanceof Error ? err.message : "Something went wrong.",
        }));
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [body, attempt]);

  return { ...result, retry: () => setAttempt((a) => a + 1) };
}

function Settings({
  state,
  signedIn,
  onChange,
}: {
  state: DraftState;
  signedIn: boolean;
  onChange: (patch: Partial<DraftState>) => void;
}) {
  const bracketId = useId();
  const positionId = useId();
  const poolId = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="grid gap-2">
        <label htmlFor={bracketId} className="text-sm font-medium">
          Rank
        </label>
        <select
          id={bracketId}
          value={state.bracket}
          onChange={(e) => onChange({ bracket: Number(e.target.value) })}
          className={selectClass}
        >
          {BRACKETS.map((b) => (
            <option key={b.id} value={b.id}>
              {b.id === 0 ? "All ranks" : b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <label htmlFor={positionId} className="text-sm font-medium">
          Your position
        </label>
        <select
          id={positionId}
          value={state.position}
          onChange={(e) => onChange({ position: Number(e.target.value) })}
          className={selectClass}
        >
          {POSITIONS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id === 0 ? "Any position" : p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        {signedIn ? (
          <label htmlFor={poolId} className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input
              id={poolId}
              type="checkbox"
              checked={state.poolOnly}
              onChange={(e) => onChange({ poolOnly: e.target.checked })}
              className="size-4 accent-[var(--accent)]"
            />
            Only heroes I&apos;ve played at least 5 times
          </label>
        ) : (
          <p className="text-sm text-muted">
            <Link
              href="/signin?next=/draft"
              className="text-accent-fg underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to include heroes you play well.
          </p>
        )}
      </div>
    </div>
  );
}

function TargetSwitch({
  value,
  onChange,
  counts,
}: {
  value: Target;
  onChange: (t: Target) => void;
  counts: DraftState;
}) {
  const options: { value: Target; label: string }[] = [
    { value: "allies", label: "Your team" },
    { value: "enemies", label: "Enemy" },
    { value: "bans", label: "Ban" },
  ];
  return (
    <div role="group" aria-label="Add heroes to" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Add to</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "h-9 cursor-pointer rounded-full border px-3.5 text-sm transition-colors",
            value === o.value
              ? "border-accent-fg bg-accent-soft text-fg"
              : "border-border text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {o.label}
          <span className="ml-1.5 font-mono text-xs text-muted tabular-nums">
            {counts[o.value].length}/{LIMITS[o.value]}
          </span>
        </button>
      ))}
    </div>
  );
}

interface RowProps {
  ids: number[];
  byId: Map<number, HeroInfo>;
  active: boolean;
  onChoose: (group: Target) => void;
  onRemove: (group: Target, id: number) => void;
}

function TeamRow({
  label,
  group,
  withYou = false,
  ...props
}: RowProps & { label: string; group: "allies" | "enemies"; withYou?: boolean }) {
  const { ids, byId, active, onChoose, onRemove } = props;
  const empty = LIMITS[group] - ids.length;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className={cn("font-display text-lg font-bold", active && "text-accent-fg")}>
          {label}
        </h2>
        {active ? <span className="text-xs text-muted">Adding here</span> : null}
      </div>
      <ul className="grid grid-cols-5 gap-2">
        {withYou ? (
          <li className="grid aspect-[16/9] place-items-center rounded-md border border-dashed border-border-strong font-display-sc text-sm font-bold text-accent-fg">
            You
          </li>
        ) : null}
        {ids.map((id) => {
          const hero = byId.get(id);
          if (!hero) return null;
          return (
            <li key={id} className="group relative">
              <HeroPortrait hero={hero} />
              <button
                type="button"
                onClick={() => onRemove(group, id)}
                aria-label={`Remove ${hero.name}`}
                className="absolute -top-2 -right-2 grid size-7 cursor-pointer place-items-center rounded-full border border-border bg-surface text-muted shadow-1 hover:text-fg"
              >
                <X size={14} aria-hidden />
              </button>
            </li>
          );
        })}
        {Array.from({ length: empty }, (_, i) => (
          <li key={`empty-${i}`}>
            <button
              type="button"
              onClick={() => onChoose(group)}
              aria-label={`Add a hero to ${label.toLowerCase()}`}
              className={cn(
                "grid aspect-[16/9] w-full cursor-pointer place-items-center rounded-md border border-dashed text-muted transition-colors hover:bg-surface-2 hover:text-fg",
                active ? "border-accent-fg" : "border-border",
              )}
            >
              <Plus size={18} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BanRow({ ids, byId, active, onChoose, onRemove }: RowProps) {
  return (
    <div className="grid gap-2">
      <h2 className={cn("font-display text-lg font-bold", active && "text-accent-fg")}>Bans</h2>
      <ul className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const hero = byId.get(id);
          if (!hero) return null;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onRemove("bans", id)}
                aria-label={`Remove ${hero.name} from bans`}
                title={`${hero.name} (click to remove)`}
                className="relative block w-16 cursor-pointer"
              >
                <HeroPortrait hero={hero} decorative className="opacity-60 grayscale" />
                <X
                  size={20}
                  aria-hidden
                  className="absolute inset-0 m-auto text-danger drop-shadow"
                  weight="bold"
                />
              </button>
            </li>
          );
        })}
        {ids.length < LIMITS.bans ? (
          <li>
            <button
              type="button"
              onClick={() => onChoose("bans")}
              aria-label="Add a ban"
              className={cn(
                "grid aspect-[16/9] w-16 cursor-pointer place-items-center rounded-md border border-dashed text-muted hover:bg-surface-2 hover:text-fg",
                active ? "border-accent-fg" : "border-border",
              )}
            >
              <Plus size={16} aria-hidden />
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function Suggestions({
  status,
  data,
  error,
  retry,
  byId,
  signedIn,
  hasEnemies,
}: ReturnType<typeof useDraftSuggestions> & {
  byId: Map<number, HeroInfo>;
  signedIn: boolean;
  hasEnemies: boolean;
}) {
  const [tab, setTab] = useState<"picks" | "bans">("picks");
  const tabsId = useId();
  const list = tab === "picks" ? data?.picks : data?.bans;

  return (
    <FramedPanel as="section" className="p-5 lg:sticky lg:top-24">
      <div className="grid gap-4">
        <div
          role="tablist"
          aria-label="Suggestions"
          className="flex gap-1 rounded-full border border-border p-1"
        >
          {(["picks", "bans"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              id={`${tabsId}-${t}`}
              aria-selected={tab === t}
              aria-controls={`${tabsId}-panel`}
              onClick={() => setTab(t)}
              className={cn(
                "h-9 flex-1 cursor-pointer rounded-full text-sm transition-colors",
                tab === t ? "bg-accent text-on-accent" : "text-muted hover:text-fg",
              )}
            >
              {t === "picks" ? "Suggested picks" : "Suggested bans"}
            </button>
          ))}
        </div>

        <div
          id={`${tabsId}-panel`}
          role="tabpanel"
          aria-labelledby={`${tabsId}-${tab}`}
          aria-busy={status === "loading"}
          className="grid gap-4"
        >
          {data?.warnings.length && tab === "picks" ? (
            <ul className="grid gap-2" aria-label="Draft warnings">
              {data.warnings.map((w) => (
                <li key={w} className="flex gap-2 rounded-md bg-surface-2 px-3 py-2 text-sm">
                  <Warning
                    size={18}
                    weight="fill"
                    aria-hidden
                    className="mt-0.5 shrink-0 text-accent-fg"
                  />
                  {w}
                </li>
              ))}
            </ul>
          ) : null}

          {status === "error" && !data ? (
            <div role="alert" className="grid justify-items-start gap-3">
              <p className="text-sm">{error}</p>
              <Button variant="secondary" size="sm" onClick={retry}>
                Try again
              </Button>
            </div>
          ) : !data ? (
            <SuggestionSkeleton />
          ) : (
            <>
              <p className="text-sm text-muted">
                {tab === "picks" && !hasEnemies
                  ? `Add enemy picks to see counters. For now these are based on how heroes do in ${data.bracketLabel}.`
                  : `Based on ${data.bracketLabel} games.`}
              </p>
              <ol
                className={cn(
                  "grid gap-3 transition-opacity",
                  status === "loading" && "opacity-60",
                )}
              >
                {list?.length ? (
                  list.map((s, i) => {
                    const hero = byId.get(s.heroId);
                    if (!hero) return null;
                    return (
                      <SuggestionItem
                        key={s.heroId}
                        hero={hero}
                        score={s.score}
                        reasons={s.reasons}
                        top={i === 0 && tab === "picks"}
                      />
                    );
                  })
                ) : (
                  <li className="text-sm text-muted">
                    No heroes fit these filters. Try another position or turn off the hero pool
                    filter.
                  </li>
                )}
              </ol>
              <SourceNotes data={data} signedIn={signedIn} />
            </>
          )}

          {status === "error" && data ? (
            <p role="alert" className="text-sm text-danger">
              {error}{" "}
              <button type="button" onClick={retry} className="cursor-pointer underline">
                Retry
              </button>
            </p>
          ) : null}
        </div>
      </div>
    </FramedPanel>
  );
}

function SuggestionItem({
  hero,
  score,
  reasons,
  top,
}: {
  hero: HeroInfo;
  score: number;
  reasons: Reason[];
  top: boolean;
}) {
  return (
    <li className="relative grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <HeroPortrait hero={hero} decorative />
      <div className="grid gap-1">
        <div className="flex items-baseline justify-between gap-2 pr-5">
          <h3 className="font-display font-bold">{hero.name}</h3>
          <span
            className="font-mono text-xs text-muted tabular-nums"
            title="Overall score in percentage points"
          >
            {score >= 0 ? "+" : ""}
            {score.toFixed(1)}
          </span>
        </div>
        {reasons.length ? (
          <ul className="grid gap-0.5">
            {reasons.slice(0, 4).map((r) => (
              <li key={r.text} className="flex items-start gap-1.5 text-sm">
                <MaskedSvg
                  src="/brand/ornament-margin-note.svg"
                  className={cn(
                    "mt-1.5 size-2.5",
                    r.kind === "weak" ? "text-danger" : "text-accent",
                  )}
                />
                <span className={r.kind === "weak" ? "text-muted" : undefined}>{r.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {top ? <Ribbon className="top-2 right-0 h-10 w-3" /> : null}
    </li>
  );
}

function SuggestionSkeleton() {
  return (
    <ul className="grid gap-3" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="grid grid-cols-[4.5rem_1fr] gap-3">
          <div className="aspect-[16/9] rounded-md bg-surface-2" />
          <div className="grid content-start gap-2">
            <div className="h-4 w-1/2 rounded-sm bg-surface-2" />
            <div className="h-3 w-5/6 rounded-sm bg-surface-2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function SourceNotes({ data, signedIn }: { data: DraftResponse; signedIn: boolean }) {
  const notes: string[] = [];
  if (data.source === "opendota") {
    notes.push(
      "STRATZ isn't reachable right now, so matchups come from pro games and the position filter is off.",
    );
  }
  if (signedIn && data.pool === "error") {
    notes.push("We couldn't load your hero stats. Your match data might be private.");
  }
  if (!notes.length) return null;
  return (
    <ul className="grid gap-1 border-t border-border pt-3 text-xs text-muted">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}
