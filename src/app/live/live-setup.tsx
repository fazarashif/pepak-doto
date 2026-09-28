"use client";

import { useId, useMemo, useRef, useState } from "react";
import { PencilSimple, Plus, X } from "@phosphor-icons/react";
import { HeroPicker } from "@/components/hero-picker";
import { HeroPortrait } from "@/components/hero-portrait";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { BRACKETS, POSITIONS, type HeroInfo } from "@/lib/dota";
import type { GameState } from "@/lib/items/advisor";
import type { LiveState } from "@/lib/live/types";
import { useLiveParams } from "./use-live-params";

type Target = "hero" | "allies" | "enemies";

const LIMITS = { allies: 4, enemies: 5 } as const;
const TARGET_LABEL: Record<Target, string> = {
  hero: "Choose your hero",
  allies: "Add to your team",
  enemies: "Add to the enemy team",
};

const STATES: { value: GameState; label: string }[] = [
  { value: "behind", label: "Behind" },
  { value: "even", label: "Even" },
  { value: "ahead", label: "Ahead" },
];

const QUICK_MINUTES = [10, 15, 20, 25, 30, 40, 50];

const selectClass =
  "h-11 w-full rounded-md border border-border bg-surface px-3 text-base focus:border-accent-fg focus:outline-none sm:text-sm";

export function LiveSetup({
  heroes,
  state,
  resolvedPosition,
}: {
  heroes: HeroInfo[];
  state: LiveState;
  /** Posisi yang dipakai hasil, kalau user memilih "most played". */
  resolvedPosition: number | null;
}) {
  const { update, pending } = useLiveParams();
  const [target, setTarget] = useState<Target>("hero");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const ids = { position: useId(), bracket: useId(), minute: useId(), state: useId() };

  const byId = useMemo(() => new Map(heroes.map((h) => [h.id, h])), [heroes]);
  const taken = useMemo(
    () => new Set([...(state.hero ? [state.hero] : []), ...state.allies, ...state.enemies]),
    [state.hero, state.allies, state.enemies],
  );
  const hero = state.hero ? byId.get(state.hero) : undefined;
  // Setelah hero dan musuh terisi, setelan dilipat supaya hasil langsung terlihat di HP.
  const complete = Boolean(hero) && state.enemies.length > 0;
  const [editing, setEditing] = useState(!complete);

  function open(t: Target) {
    setTarget(t);
    dialogRef.current?.showModal();
  }

  function pick(h: HeroInfo) {
    dialogRef.current?.close();
    if (target === "hero") {
      update({ h: String(h.id) });
      return;
    }
    const list = state[target];
    if (list.length >= LIMITS[target] || taken.has(h.id)) return;
    update({ [target === "allies" ? "a" : "e"]: [...list, h.id].join(",") });
  }

  function setMinute(m: number | null) {
    update({ m: m === null ? null : String(m) });
  }

  function remove(group: "allies" | "enemies", id: number) {
    const list = state[group].filter((x) => x !== id);
    update({ [group === "allies" ? "a" : "e"]: list.join(",") || null });
  }

  const positionName = POSITIONS.find((p) => p.id === (resolvedPosition ?? state.position))?.name;
  const bracketName = state.bracket
    ? BRACKETS.find((b) => b.id === state.bracket)?.name
    : "All ranks";

  return (
    <section
      aria-label="Game setup"
      aria-busy={pending}
      className={cn(
        "grid gap-5 rounded-lg border border-border bg-surface p-4 transition-opacity sm:p-5",
        pending && "opacity-70",
      )}
    >
      {complete && !editing && hero ? (
        <div className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3">
          <HeroPortrait hero={hero} decorative />
          <div className="grid min-w-0 gap-1">
            <p className="font-display text-lg leading-tight font-bold">{hero.name}</p>
            <p className="truncate text-sm text-muted">
              {positionName ?? "Any position"}, {bracketName}
            </p>
            <ul className="flex gap-1" aria-label="Enemy heroes">
              {state.enemies.map((id) => {
                const h = byId.get(id);
                return h ? (
                  <li key={id} className="w-8">
                    <HeroPortrait hero={h} className="rounded-sm" />
                  </li>
                ) : null;
              })}
            </ul>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <PencilSimple size={16} aria-hidden />
            Edit
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <button
              type="button"
              onClick={() => open("hero")}
              className={cn(
                "cursor-pointer rounded-md",
                !hero &&
                  "grid aspect-[16/9] w-full place-items-center border border-dashed border-accent-fg text-accent-fg hover:bg-surface-2",
              )}
              aria-label={hero ? `Your hero: ${hero.name}. Change` : "Choose your hero"}
            >
              {hero ? <HeroPortrait hero={hero} decorative /> : <Plus size={20} aria-hidden />}
            </button>
            <div className="grid gap-1">
              <p className="font-display text-xl font-bold">{hero ? hero.name : "Your hero"}</p>
              <p className="text-sm text-muted">
                {hero
                  ? "Tap the portrait to change."
                  : "Choose the hero you're playing to get a build and counters."}
              </p>
            </div>
          </div>

          <TeamRow
            label="Your team"
            ids={state.allies}
            limit={LIMITS.allies}
            byId={byId}
            onAdd={() => open("allies")}
            onRemove={(id) => remove("allies", id)}
          />
          <TeamRow
            label="Enemy team"
            ids={state.enemies}
            limit={LIMITS.enemies}
            byId={byId}
            onAdd={() => open("enemies")}
            onRemove={(id) => remove("enemies", id)}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor={ids.position} className="text-sm font-medium">
                Your position
              </label>
              <select
                id={ids.position}
                value={state.position}
                onChange={(e) => update({ p: e.target.value })}
                className={selectClass}
              >
                {POSITIONS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id === 0 ? "Most played for this hero" : p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor={ids.bracket} className="text-sm font-medium">
                Rank
              </label>
              <select
                id={ids.bracket}
                value={state.bracket}
                onChange={(e) => update({ r: e.target.value })}
                className={selectClass}
              >
                {BRACKETS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id === 0 ? "All ranks" : b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {complete ? (
            <Button variant="secondary" className="w-fit" onClick={() => setEditing(false)}>
              Done
            </Button>
          ) : null}
        </>
      )}

      <div className="grid gap-4 border-t border-border pt-4">
        <div className="grid gap-2">
          <p id={ids.state} className="text-sm font-medium">
            How is the game going?
          </p>
          <div
            role="radiogroup"
            aria-labelledby={ids.state}
            className="grid grid-cols-3 gap-1 rounded-full border border-border p-1"
          >
            {STATES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={state.state === s.value}
                onClick={() => update({ s: s.value === "even" ? null : s.value })}
                className={cn(
                  "h-9 cursor-pointer rounded-full text-sm transition-colors",
                  state.state === s.value ? "bg-accent text-on-accent" : "text-muted hover:text-fg",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2">
          <p id={ids.minute} className="text-sm font-medium">
            Game time{" "}
            <span className="font-normal text-muted">
              {state.minute === null ? "(not set)" : `minute ${state.minute}`}
            </span>
          </p>
          <div role="group" aria-labelledby={ids.minute} className="flex flex-wrap gap-1.5">
            <TimeButton
              label="−5"
              aria="5 minutes earlier"
              onClick={() => setMinute(Math.max(0, (state.minute ?? 0) - 5))}
              disabled={!state.minute}
            />
            {QUICK_MINUTES.map((m) => (
              <TimeButton
                key={m}
                label={m === 50 ? "50+" : String(m)}
                aria={`Minute ${m}`}
                pressed={state.minute === m}
                onClick={() => setMinute(m)}
              />
            ))}
            <TimeButton
              label="+5"
              aria="5 minutes later"
              onClick={() => setMinute(Math.min(180, (state.minute ?? 0) + 5))}
            />
            {state.minute !== null ? (
              <TimeButton label="Clear" aria="Clear game time" onClick={() => setMinute(null)} />
            ) : null}
          </div>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        aria-label={TARGET_LABEL[target]}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-bg p-4 text-fg backdrop:bg-black/60 lg:m-auto lg:h-[85dvh] lg:max-w-4xl lg:rounded-lg lg:border lg:border-border"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-display text-lg font-bold">{TARGET_LABEL[target]}</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close"
            onClick={() => dialogRef.current?.close()}
          >
            <X size={22} aria-hidden />
          </Button>
        </div>
        <HeroPicker
          heroes={heroes}
          disabledIds={target === "hero" ? new Set([...state.allies, ...state.enemies]) : taken}
          onPick={pick}
        />
      </dialog>
    </section>
  );
}

function TeamRow({
  label,
  ids,
  limit,
  byId,
  onAdd,
  onRemove,
}: {
  label: string;
  ids: number[];
  limit: number;
  byId: Map<number, HeroInfo>;
  onAdd: () => void;
  onRemove: (id: number) => void;
}) {
  return (
    <div className="grid gap-2">
      <h2 className="text-sm font-medium">
        {label}{" "}
        <span className="font-mono text-xs text-muted tabular-nums">
          {ids.length}/{limit}
        </span>
      </h2>
      <ul className="grid grid-cols-5 gap-2">
        {ids.map((id) => {
          const hero = byId.get(id);
          if (!hero) return null;
          return (
            <li key={id}>
              {/* Seluruh potret jadi tombol hapus, supaya mudah diketuk di HP. */}
              <button
                type="button"
                onClick={() => onRemove(id)}
                aria-label={`Remove ${hero.name}`}
                title={`Remove ${hero.name}`}
                className="group relative block w-full cursor-pointer rounded-md"
              >
                <HeroPortrait hero={hero} decorative />
                <span
                  aria-hidden
                  className="absolute top-1 right-1 grid size-5 place-items-center rounded-full bg-bg/80 text-muted group-hover:text-fg"
                >
                  <X size={12} />
                </span>
              </button>
            </li>
          );
        })}
        {ids.length < limit ? (
          <li>
            <button
              type="button"
              onClick={onAdd}
              aria-label={`Add a hero to ${label.toLowerCase()}`}
              className="grid aspect-[16/9] w-full cursor-pointer place-items-center rounded-md border border-dashed border-border text-muted hover:bg-surface-2 hover:text-fg"
            >
              <Plus size={18} aria-hidden />
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function TimeButton({
  label,
  aria,
  onClick,
  pressed,
  disabled = false,
}: {
  label: string;
  aria: string;
  onClick: () => void;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      aria-pressed={pressed}
      className={cn(
        "h-9 min-w-11 cursor-pointer rounded-full border px-3 font-mono text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        pressed
          ? "border-accent-fg bg-accent text-on-accent"
          : "border-border text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      {label}
    </button>
  );
}
