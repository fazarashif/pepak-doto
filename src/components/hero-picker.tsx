"use client";

import { useDeferredValue, useId, useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { MaskedSvg, Ribbon } from "@/components/brand";
import { HeroPortrait } from "@/components/hero-portrait";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { ATTR_LABEL, type HeroInfo } from "@/lib/dota";

// "all" di data hero berarti Universal, jadi filter memakai nama sendiri agar tidak tertukar.
type AttrFilter = "any" | HeroInfo["primaryAttr"];

const FILTER_OPTIONS: { value: AttrFilter; label: string }[] = [
  { value: "any", label: "All" },
  { value: "str", label: ATTR_LABEL.str },
  { value: "agi", label: ATTR_LABEL.agi },
  { value: "int", label: ATTR_LABEL.int },
  { value: "all", label: ATTR_LABEL.all },
];

interface Props {
  heroes: HeroInfo[];
  onPick: (hero: HeroInfo) => void;
  /** Hero yang sedang dipilih (ditandai). */
  selectedIds?: ReadonlySet<number>;
  /** Hero yang tidak bisa dipilih, mis. sudah di-pick atau di-ban. */
  disabledIds?: ReadonlySet<number>;
  className?: string;
}

const EMPTY = new Set<number>();

export function HeroPicker({
  heroes,
  onPick,
  selectedIds = EMPTY,
  disabledIds = EMPTY,
  className,
}: Props) {
  const [query, setQuery] = useState("");
  const [attr, setAttr] = useState<AttrFilter>("any");
  const deferredQuery = useDeferredValue(query);
  const searchId = useId();

  const visible = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    return heroes.filter((h) => {
      if (attr !== "any" && h.primaryAttr !== attr) return false;
      return !q || h.name.toLowerCase().includes(q);
    });
  }, [heroes, deferredQuery, attr]);

  return (
    <div className={cn("grid gap-4", className)}>
      <div className="grid gap-3">
        <div className="grid max-w-sm gap-2">
          <label htmlFor={searchId} className="text-sm text-muted">
            Search heroes
          </label>
          <div className="relative">
            <MagnifyingGlass
              size={18}
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Pudge"
              autoComplete="off"
              className="h-11 w-full rounded-md border border-border bg-surface pr-3 pl-10 text-base placeholder:text-muted/80 focus:border-accent-fg focus:outline-none sm:text-sm"
            />
          </div>
        </div>

        <div role="group" aria-label="Filter by attribute" className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={attr === f.value}
              onClick={() => setAttr(f.value)}
              className={cn(
                "h-9 cursor-pointer rounded-full border px-3.5 text-sm transition-colors",
                attr === f.value
                  ? "border-accent-fg bg-accent/15 text-fg"
                  : "border-border text-muted hover:bg-surface-2 hover:text-fg",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} heroes shown
      </p>

      {visible.length === 0 ? (
        <div className="batik grid justify-items-start gap-3 overflow-hidden rounded-lg border border-border p-6">
          <MaskedSvg src="/brand/empty-no-heroes.svg" className="h-32 w-48 text-accent" />
          <p className="text-sm text-muted">
            No hero matches &ldquo;{deferredQuery}&rdquo;
            {attr !== "any" ? " with this attribute" : ""}.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setQuery("");
              setAttr("any");
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {visible.map((hero) => {
            const selected = selectedIds.has(hero.id);
            const disabled = disabledIds.has(hero.id);
            return (
              <li key={hero.id}>
                <button
                  type="button"
                  onClick={() => onPick(hero)}
                  disabled={disabled}
                  aria-pressed={selected}
                  className={cn(
                    "group relative grid w-full cursor-pointer gap-1 rounded-md p-1 text-left transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40",
                    selected && "bg-accent-soft ring-2 ring-accent-fg",
                  )}
                >
                  <HeroPortrait hero={hero} decorative />
                  {/* Pita hanya untuk satu item per layar, jadi hanya saat satu hero dipilih. */}
                  {selected && selectedIds.size === 1 ? (
                    <Ribbon className="top-0 right-2 h-10 w-3" />
                  ) : null}
                  <span className="truncate px-0.5 text-xs text-muted group-hover:text-fg">
                    {hero.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
