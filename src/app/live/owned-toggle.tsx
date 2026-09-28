"use client";

import { Check } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useLiveParams } from "./use-live-params";

/** Tandai item yang sudah dibeli. Disimpan di URL (`o`), jadi aman saat refresh. */
export function OwnedToggle({
  itemId,
  owned,
  name,
}: {
  itemId: number;
  owned: boolean;
  name: string;
}) {
  const { update, pending } = useLiveParams();

  function toggle() {
    const current =
      new URLSearchParams(window.location.search)
        .get("o")
        ?.split(",")
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0) ?? [];
    const next = owned ? current.filter((id) => id !== itemId) : [...new Set([...current, itemId])];
    update({ o: next.join(",") || null });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={owned}
      aria-label={owned ? `${name}: bought. Undo` : `Mark ${name} as bought`}
      className={cn(
        "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition-colors disabled:cursor-wait",
        owned
          ? "border-accent-fg bg-accent-soft text-fg"
          : "border-border text-muted hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Check size={14} weight={owned ? "bold" : "regular"} aria-hidden />
      {owned ? "Got it" : "Got it?"}
    </button>
  );
}
