"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowRight, Plus, Warning, X } from "@phosphor-icons/react";
import { FramedPanel, MaskedSvg, Ribbon } from "@/components/brand";
import { HeroPicker } from "@/components/hero-picker";
import { HeroPortrait } from "@/components/hero-portrait";
import { Button, buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BRACKETS, POSITIONS, type HeroInfo } from "@/lib/dota";
import type { DraftRound, LaneOutlook, Reason } from "@/lib/draft/engine";
import { ALL_POSITIONS, assignPositions, bestOpenPosition } from "@/lib/draft/positions";
import {
  allySlots,
  EMPTY_TEAM,
  toSearchParams,
  type DraftRequest,
  type DraftResponse,
  type DraftState,
} from "@/lib/draft/types";

type Group = "allies" | "enemies" | "bans";
/** Ke mana hero berikutnya ditambahkan. `position` hanya untuk tim sendiri. */
interface Target {
  group: Group;
  position?: number;
}

const LIMITS: Record<Group, number> = { allies: 5, enemies: 5, bans: 16 };
const TARGET_LABEL: Record<Group, string> = {
  allies: "your team",
  enemies: "the enemy team",
  bans: "bans",
};
const POSITION_SHORT = ["", "Carry", "Mid", "Offlane", "Soft sup", "Hard sup"];
const LANE_LABEL: Record<LaneOutlook["lane"], string> = {
  safe: "Safe lane",
  mid: "Mid",
  off: "Off lane",
};

const ROUNDS: { value: DraftRound; label: string; help: string }[] = [
  {
    value: 1,
    label: "Round 1",
    help: "Both teams pick 2 heroes at once without seeing each other. The enemy can still answer these picks in rounds 2 and 3, so heroes that are hard to counter rank higher.",
  },
  {
    value: 2,
    label: "Round 2",
    help: "The enemy's first two picks are visible. Their last pick can still answer yours, so easy-to-counter heroes rank a little lower.",
  },
  {
    value: 3,
    label: "Round 3",
    help: "Last pick. Everything else is visible, so suggestions go for the strongest counter.",
  },
];

const selectClass =
  "h-11 w-full rounded-md border border-border bg-surface px-3 text-base focus:border-accent-fg focus:outline-none sm:text-sm";
const slotSelectClass =
  "h-8 w-full min-w-0 cursor-pointer rounded-md border border-border bg-surface px-1 text-xs focus:border-accent-fg focus:outline-none";

/** Lebar layar tempat pemilih hero tampil di samping draft (bukan dialog). */
const isWide = () => window.matchMedia("(min-width: 1024px)").matches;

interface Props {
  heroes: HeroInfo[];
  /** [heroId, porsi posisi 1..5] untuk menebak posisi. */
  shares: [number, number[]][];
  initial: DraftState;
  signedIn: boolean;
}

export function DraftBoard({ heroes, shares, initial, signedIn }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<DraftState>(initial);
  const [target, setTarget] = useState<Target>({ group: "enemies" });
  const dialogRef = useRef<HTMLDialogElement>(null);

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const shareMap = useMemo(() => new Map(shares), [shares]);
  const taken = useMemo(
    () => new Set([...state.allies.filter(Boolean), ...state.enemies, ...state.bans]),
    [state.allies, state.enemies, state.bans],
  );

  // Posisi musuh: yang diisi user tetap, sisanya ditebak dari statistik posisi.
  const enemyPositions = useMemo(() => {
    const fixed = new Map(
      state.enemies.map((id, i) => [id, state.enemyPos[i] ?? 0] as const).filter(([, p]) => p),
    );
    return assignPositions(state.enemies, shareMap, fixed);
  }, [state.enemies, state.enemyPos, shareMap]);

  const request: DraftRequest = useMemo(
    () => ({
      allies: allySlots(state.allies),
      enemies: state.enemies.map((heroId) => ({
        heroId,
        position: enemyPositions.get(heroId) ?? 0,
      })),
      bans: state.bans,
      bracket: state.bracket,
      position: state.position,
      round: state.round,
      poolOnly: state.poolOnly,
    }),
    [state, enemyPositions],
  );
  const suggestions = useDraftSuggestions(request);

  const allyCount = state.allies.filter(Boolean).length;
  const count = (g: Group) =>
    g === "allies" ? allyCount : g === "enemies" ? state.enemies.length : state.bans.length;
  const targetFull = count(target.group) >= LIMITS[target.group];

  // Simpan draft di URL supaya aman saat refresh dan bisa dibagikan.
  useEffect(() => {
    router.replace(`${pathname}?${toSearchParams(state)}`, { scroll: false });
  }, [state, pathname, router]);

  function add(hero: HeroInfo) {
    setState((s) => {
      if (s.allies.includes(hero.id) || s.enemies.includes(hero.id) || s.bans.includes(hero.id)) {
        return s;
      }
      if (target.group === "allies") {
        const open = ALL_POSITIONS.filter((p) => !s.allies[p - 1]);
        const pos =
          target.position && open.includes(target.position as (typeof open)[number])
            ? target.position
            : bestOpenPosition(hero.id, open, shareMap);
        if (!pos) return s;
        const allies = [...s.allies];
        allies[pos - 1] = hero.id;
        return { ...s, allies };
      }
      if (target.group === "enemies") {
        if (s.enemies.length >= LIMITS.enemies) return s;
        return { ...s, enemies: [...s.enemies, hero.id], enemyPos: [...s.enemyPos, 0] };
      }
      if (s.bans.length >= LIMITS.bans) return s;
      return { ...s, bans: [...s.bans, hero.id] };
    });
    // Posisi pilihan hanya untuk satu hero; hero berikutnya ditempatkan otomatis.
    if (target.position) setTarget({ group: target.group });
    dialogRef.current?.close();
  }

  function choose(next: Target) {
    setTarget(next);
    // Di layar kecil, pemilih hero dibuka sebagai dialog.
    if (!isWide()) dialogRef.current?.showModal();
  }

  /** Di layar kecil, mengetik di luar kolom isian membuka dialog pemilih hero. */
  const openPickerOnType = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || isWide()) return false;
    dialog.showModal();
    return true;
  }, []);

  function removeAlly(position: number) {
    setState((s) => {
      const allies = [...s.allies];
      allies[position - 1] = 0;
      return { ...s, allies };
    });
  }

  function moveAlly(from: number, to: number) {
    setState((s) => {
      const allies = [...s.allies];
      [allies[from - 1], allies[to - 1]] = [allies[to - 1], allies[from - 1]];
      return { ...s, allies };
    });
  }

  function removeEnemy(id: number) {
    setState((s) => {
      const i = s.enemies.indexOf(id);
      if (i < 0) return s;
      return {
        ...s,
        enemies: s.enemies.filter((_, j) => j !== i),
        enemyPos: s.enemyPos.filter((_, j) => j !== i),
      };
    });
  }

  /** Tetapkan posisi musuh. Musuh lain yang sudah ditetapkan di posisi itu kembali ditebak. */
  function setEnemyPosition(id: number, position: number) {
    setState((s) => ({
      ...s,
      enemyPos: s.enemies.map((e, i) =>
        e === id ? position : position && s.enemyPos[i] === position ? 0 : (s.enemyPos[i] ?? 0),
      ),
    }));
  }

  const picker = (
    <div className="grid gap-3">
      <TargetSwitch value={target} onChange={setTarget} count={count} />
      {targetFull ? (
        <p role="status" className="text-sm text-muted">
          {target.group === "bans" ? "The ban list" : `The slots for ${TARGET_LABEL[target.group]}`}{" "}
          are full. Remove a hero or add to another group.
        </p>
      ) : null}
      <HeroPicker
        heroes={heroes}
        disabledIds={taken}
        onPick={add}
        enterVerb="add"
        captureTyping
        revealOnType={openPickerOnType}
      />
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
          <AllyRow
            team={state.allies}
            you={state.position}
            byId={byId}
            target={target}
            onChoose={choose}
            onRemove={removeAlly}
            onMove={moveAlly}
          />
          <EnemyRow
            enemies={state.enemies}
            overrides={state.enemyPos}
            positions={enemyPositions}
            byId={byId}
            active={target.group === "enemies"}
            onChoose={() => choose({ group: "enemies" })}
            onRemove={removeEnemy}
            onSetPosition={setEnemyPosition}
          />
          {suggestions.data?.lanes.length ? (
            <Lanes lanes={suggestions.data.lanes} byId={byId} />
          ) : null}
          <BanRow
            ids={state.bans}
            byId={byId}
            active={target.group === "bans"}
            onChoose={() => choose({ group: "bans" })}
            onRemove={(id) => setState((s) => ({ ...s, bans: s.bans.filter((x) => x !== id) }))}
          />
          {taken.size ? (
            <div className="flex flex-wrap items-center gap-2">
              {state.enemies.length ? (
                <Link
                  href={gamePlanHref(request)}
                  className={buttonStyles({ variant: "secondary", size: "sm" })}
                >
                  Start game plan
                  <ArrowRight size={16} aria-hidden />
                </Link>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setState((s) => ({
                    ...s,
                    allies: [...EMPTY_TEAM],
                    enemies: [],
                    enemyPos: [],
                    bans: [],
                    round: 1,
                  }))
                }
              >
                Clear draft
              </Button>
            </div>
          ) : null}
        </section>

        <div className="hidden lg:block">{picker}</div>
      </div>

      <Suggestions
        {...suggestions}
        byId={byId}
        signedIn={signedIn}
        request={request}
        onRound={(round) => setState((s) => ({ ...s, round }))}
      />

      <dialog
        ref={dialogRef}
        aria-label={`Add a hero to ${TARGET_LABEL[target.group]}`}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-4 text-fg backdrop:bg-black/60"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-display text-lg font-bold">
            Add to {TARGET_LABEL[target.group]}
            {target.position ? ` (Pos ${target.position})` : ""}
          </p>
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

/** Buka Game Plan dengan hero dan setelan dari draft ini. */
function gamePlanHref(draft: DraftRequest, heroId?: number, position?: number) {
  const pos = position ?? draft.position;
  const hero = heroId ?? draft.allies.find((a) => a.position === pos)?.heroId;
  const params = new URLSearchParams();
  if (hero) params.set("h", String(hero));
  const allies = draft.allies.filter((a) => a.heroId !== hero).map((a) => a.heroId);
  if (allies.length) params.set("a", allies.join(","));
  if (draft.enemies.length) params.set("e", draft.enemies.map((e) => e.heroId).join(","));
  params.set("p", String(pos));
  params.set("r", String(draft.bracket));
  return `/live?${params}`;
}

function useDraftSuggestions(request: DraftRequest) {
  const [result, setResult] = useState<{
    status: "loading" | "ready" | "error";
    data?: DraftResponse;
    error?: string;
  }>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const body = JSON.stringify(request);

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
  const roundHelpId = useId();
  const round = ROUNDS.find((r) => r.value === state.round)!;
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
              {p.id === 0 ? "Not set" : p.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="grid gap-2 sm:col-span-2" aria-describedby={roundHelpId}>
        <legend className="mb-2 text-sm font-medium">Pick round</legend>
        <div className="flex gap-1 rounded-full border border-border p-1">
          {ROUNDS.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={state.round === r.value}
              onClick={() => onChange({ round: r.value })}
              className={cn(
                "h-9 flex-1 cursor-pointer rounded-full text-sm transition-colors",
                state.round === r.value ? "bg-accent text-on-accent" : "text-muted hover:text-fg",
              )}
            >
              {r.label}
              {r.value === 3 ? <span className="hidden sm:inline"> (last pick)</span> : null}
            </button>
          ))}
        </div>
        <p id={roundHelpId} className="max-w-[70ch] text-sm text-muted">
          {round.help}
        </p>
      </fieldset>

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
            For my position, only heroes I&apos;ve played at least 5 times
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
  count,
}: {
  value: Target;
  onChange: (t: Target) => void;
  count: (g: Group) => number;
}) {
  const options: { value: Group; label: string }[] = [
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
          aria-pressed={value.group === o.value}
          onClick={() => onChange({ group: o.value })}
          className={cn(
            "h-9 cursor-pointer rounded-full border px-3.5 text-sm transition-colors",
            value.group === o.value
              ? "border-accent-fg bg-accent-soft text-fg"
              : "border-border text-muted hover:bg-surface-2 hover:text-fg",
          )}
        >
          {o.label}
          {o.value === "allies" && value.group === "allies" && value.position
            ? ` · Pos ${value.position}`
            : null}
          <span className="ml-1.5 font-mono text-xs text-muted tabular-nums">
            {count(o.value)}/{LIMITS[o.value]}
          </span>
        </button>
      ))}
    </div>
  );
}

function RowHeading({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className={cn("font-display text-lg font-bold", active && "text-accent-fg")}>{label}</h2>
      {active ? <span className="text-xs text-muted">Adding here</span> : null}
    </div>
  );
}

function SlotPortrait({
  hero,
  onRemove,
  removeLabel,
}: {
  hero: HeroInfo;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="relative">
      <HeroPortrait hero={hero} />
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute -top-2 -right-2 grid size-7 cursor-pointer place-items-center rounded-full border border-border bg-surface text-muted shadow-1 hover:text-fg"
      >
        <X size={14} aria-hidden />
      </button>
    </div>
  );
}

function EmptySlot({
  label,
  active,
  onClick,
  you = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  you?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "grid aspect-[16/9] w-full cursor-pointer place-items-center rounded-md border border-dashed text-muted transition-colors hover:bg-surface-2 hover:text-fg",
        active ? "border-accent-fg" : you ? "border-border-strong" : "border-border",
      )}
    >
      {you ? (
        <span className="font-display-sc text-sm font-bold text-accent-fg">You</span>
      ) : (
        <Plus size={18} aria-hidden />
      )}
    </button>
  );
}

function AllyRow({
  team,
  you,
  byId,
  target,
  onChoose,
  onRemove,
  onMove,
}: {
  team: number[];
  you: number;
  byId: Map<number, HeroInfo>;
  target: Target;
  onChoose: (t: Target) => void;
  onRemove: (position: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const active = target.group === "allies";
  return (
    <div className="grid gap-2">
      <RowHeading label="Your team" active={active} />
      <ul className="grid grid-cols-5 gap-2">
        {ALL_POSITIONS.map((pos) => {
          const hero = byId.get(team[pos - 1]);
          const isYou = pos === you;
          return (
            <li key={pos} className="grid content-start gap-1.5">
              <p className="truncate text-xs text-muted">
                <span className={cn("font-medium", isYou ? "text-accent-fg" : "text-fg")}>
                  Pos {pos}
                </span>
                <span className="hidden sm:inline"> · {POSITION_SHORT[pos]}</span>
                {isYou ? <span className="hidden text-accent-fg sm:inline"> · You</span> : null}
              </p>
              {hero ? (
                <>
                  <SlotPortrait
                    hero={hero}
                    onRemove={() => onRemove(pos)}
                    removeLabel={`Remove ${hero.name}`}
                  />
                  <select
                    aria-label={`Position of ${hero.name}`}
                    value={pos}
                    onChange={(e) => onMove(pos, Number(e.target.value))}
                    className={slotSelectClass}
                  >
                    {ALL_POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <EmptySlot
                  label={`Add a hero to your team at position ${pos}${isYou ? " (you)" : ""}`}
                  active={active && target.position === pos}
                  onClick={() => onChoose({ group: "allies", position: pos })}
                  you={isYou}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EnemyRow({
  enemies,
  overrides,
  positions,
  byId,
  active,
  onChoose,
  onRemove,
  onSetPosition,
}: {
  enemies: number[];
  overrides: number[];
  positions: Map<number, number>;
  byId: Map<number, HeroInfo>;
  active: boolean;
  onChoose: () => void;
  onRemove: (id: number) => void;
  onSetPosition: (id: number, position: number) => void;
}) {
  const atPosition = new Map([...positions].map(([id, pos]) => [pos, id]));
  return (
    <div className="grid gap-2">
      <RowHeading label="Enemy team" active={active} />
      <ul className="grid grid-cols-5 gap-2">
        {ALL_POSITIONS.map((pos) => {
          const id = atPosition.get(pos);
          const hero = id ? byId.get(id) : undefined;
          const override = id ? (overrides[enemies.indexOf(id)] ?? 0) : 0;
          return (
            <li key={pos} className="grid content-start gap-1.5">
              <p className="truncate text-xs text-muted">
                <span className="font-medium text-fg">Pos {pos}</span>
                <span className="hidden sm:inline"> · {POSITION_SHORT[pos]}</span>
              </p>
              {hero && id ? (
                <>
                  <SlotPortrait
                    hero={hero}
                    onRemove={() => onRemove(id)}
                    removeLabel={`Remove ${hero.name}`}
                  />
                  <select
                    aria-label={`Position of ${hero.name}`}
                    value={override}
                    onChange={(e) => onSetPosition(id, Number(e.target.value))}
                    className={cn(slotSelectClass, !override && "border-dashed text-muted")}
                  >
                    <option value={0}>Auto</option>
                    {ALL_POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </>
              ) : (
                <EmptySlot
                  label="Add a hero to the enemy team"
                  active={active}
                  onClick={onChoose}
                />
              )}
            </li>
          );
        })}
      </ul>
      {enemies.length ? (
        <p className="text-xs text-muted">
          Enemy positions are guessed from how each hero is usually played. Set them if you know
          better.
        </p>
      ) : null}
    </div>
  );
}

function Lanes({ lanes, byId }: { lanes: LaneOutlook[]; byId: Map<number, HeroInfo> }) {
  const names = (ids: number[]) =>
    ids
      .map((id) => byId.get(id)?.name)
      .filter(Boolean)
      .join(" + ");
  return (
    <div className="grid gap-2">
      <h2 className="font-display text-lg font-bold">Lanes</h2>
      <ul className="grid gap-1.5">
        {lanes.map((l) => (
          <li
            key={l.lane}
            className="grid gap-x-3 gap-y-0.5 rounded-md bg-surface-2 px-3 py-2 text-sm sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:items-baseline"
          >
            <span className="font-medium">{LANE_LABEL[l.lane]}</span>
            <span className="text-muted">
              <span className="text-fg">{names(l.allies)}</span> vs {names(l.enemies)}
            </span>
            <span
              className={cn(
                "font-medium",
                l.verdict === "favored" && "text-accent-fg",
                l.verdict === "tough" && "text-danger",
              )}
            >
              {l.verdict === "favored" ? "Favored" : l.verdict === "tough" ? "Tough" : "Even"}{" "}
              <span className="font-mono text-xs tabular-nums">
                ({l.advantage >= 0 ? "+" : ""}
                {l.advantage.toFixed(1)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BanRow({
  ids,
  byId,
  active,
  onChoose,
  onRemove,
}: {
  ids: number[];
  byId: Map<number, HeroInfo>;
  active: boolean;
  onChoose: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <h2 className={cn("font-display text-lg font-bold", active && "text-accent-fg")}>
        Bans <span className="text-sm font-normal text-muted">(optional)</span>
      </h2>
      <ul className="flex flex-wrap gap-2">
        {ids.map((id) => {
          const hero = byId.get(id);
          if (!hero) return null;
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onRemove(id)}
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
              onClick={onChoose}
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

/** Saran pindah ronde kalau jumlah pick musuh sudah melewati ronde yang dipilih. */
function roundHint(request: DraftRequest): DraftRound | null {
  const n = request.enemies.length;
  if (request.round === 1 && n >= 2) return n >= 4 ? 3 : 2;
  if (request.round === 2 && n >= 4) return 3;
  return null;
}

function Suggestions({
  status,
  data,
  error,
  retry,
  byId,
  signedIn,
  request,
  onRound,
}: ReturnType<typeof useDraftSuggestions> & {
  byId: Map<number, HeroInfo>;
  signedIn: boolean;
  request: DraftRequest;
  onRound: (round: DraftRound) => void;
}) {
  const [tab, setTab] = useState<"picks" | "bans">("picks");
  const [forPos, setForPos] = useState<number | null>(null);
  const tabsId = useId();

  const groups = data?.picks ?? [];
  // Posisi yang dipilih bisa hilang setelah slotnya terisi; kembali ke posisi pertama (user dulu).
  const group = groups.find((g) => g.position === forPos) ?? groups[0];
  const hasEnemies = request.enemies.length > 0;
  const hint = roundHint(request);

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
          {tab === "picks" && hint ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
              <span>
                The enemy has {request.enemies.length} picks in. Move to round {hint}?
              </span>
              <Button variant="secondary" size="sm" onClick={() => onRound(hint)}>
                Round {hint}
              </Button>
            </div>
          ) : null}

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
          ) : tab === "bans" ? (
            <>
              <p className="text-sm text-muted">Based on {data.bracketLabel} games.</p>
              <SuggestionList
                items={data.bans.map((b) => ({ ...b, planHref: null }))}
                byId={byId}
                loading={status === "loading"}
                top={false}
              />
              <SourceNotes data={data} signedIn={signedIn} bracket={request.bracket} />
            </>
          ) : !group ? (
            <p className="text-sm text-muted">
              Your team is complete. Open the game plan for items and lane tips.
            </p>
          ) : (
            <>
              <div role="group" aria-label="Suggest for" className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const you = g.position === request.position;
                  return (
                    <button
                      key={g.position}
                      type="button"
                      aria-pressed={g.position === group.position}
                      onClick={() => setForPos(g.position)}
                      className={cn(
                        "h-9 cursor-pointer rounded-full border px-3 text-sm transition-colors",
                        g.position === group.position
                          ? "border-accent-fg bg-accent-soft text-fg"
                          : "border-border text-muted hover:bg-surface-2 hover:text-fg",
                      )}
                    >
                      Pos {g.position}
                      {you ? <span className="text-accent-fg"> · You</span> : null}
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-muted">
                {group.position === request.position ? "For you" : "For your teammate"} at{" "}
                {POSITION_SHORT[group.position].toLowerCase()}, round {request.round}.{" "}
                {hasEnemies
                  ? `Based on ${data.bracketLabel} games.`
                  : `No enemy picks yet, so these favor heroes that do well in ${data.bracketLabel} and are hard to counter.`}
              </p>
              <SuggestionList
                items={group.suggestions.map((s) => ({
                  ...s,
                  planHref: hasEnemies ? gamePlanHref(request, s.heroId, group.position) : null,
                }))}
                byId={byId}
                loading={status === "loading"}
                top
              />
              <SourceNotes data={data} signedIn={signedIn} bracket={request.bracket} />
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

function SuggestionList({
  items,
  byId,
  loading,
  top,
}: {
  items: { heroId: number; score: number; reasons: Reason[]; planHref: string | null }[];
  byId: Map<number, HeroInfo>;
  loading: boolean;
  /** Tandai saran pertama dengan pita. */
  top: boolean;
}) {
  return (
    <ol className={cn("grid gap-3 transition-opacity", loading && "opacity-60")}>
      {items.length ? (
        items.map((s, i) => {
          const hero = byId.get(s.heroId);
          if (!hero) return null;
          return (
            <SuggestionItem
              key={s.heroId}
              hero={hero}
              score={s.score}
              reasons={s.reasons}
              top={top && i === 0}
              planHref={s.planHref}
            />
          );
        })
      ) : (
        <li className="text-sm text-muted">
          No heroes fit these filters. Try another position or turn off the hero pool filter.
        </li>
      )}
    </ol>
  );
}

function SuggestionItem({
  hero,
  score,
  reasons,
  top,
  planHref,
}: {
  hero: HeroInfo;
  score: number;
  reasons: Reason[];
  top: boolean;
  /** Link ke Game Plan dengan hero ini, kalau musuh sudah diisi. */
  planHref: string | null;
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
        {planHref ? (
          <Link
            href={planHref}
            className="flex w-fit items-center gap-1 text-sm text-accent-fg underline-offset-4 hover:underline"
          >
            Game plan with {hero.name}
            <ArrowRight size={14} aria-hidden />
          </Link>
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

function SourceNotes({
  data,
  signedIn,
  bracket,
}: {
  data: DraftResponse;
  signedIn: boolean;
  bracket: number;
}) {
  const notes: string[] = [];
  if (data.source === "opendota") {
    notes.push(
      "STRATZ isn't reachable right now, so matchups come from pro games and the position filter is off.",
    );
  }
  if (bracket === 8) {
    notes.push(
      "Games above 8500 MMR (Immortal Draft) are private, so this rank leans on Divine games.",
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
