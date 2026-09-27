"use client";

import { useActionState } from "react";
import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { savePreferences, type PreferencesState } from "@/lib/auth/actions";
import { BRACKETS, POSITIONS } from "@/lib/dota";

interface Props {
  rankLabel: string;
  defaults: { preferredBracket: number; preferredPosition: number };
}

const selectClass =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-base focus:border-accent-fg focus:outline-none sm:text-sm";

export function PreferencesForm({ rankLabel, defaults }: Props) {
  const [state, action, pending] = useActionState<PreferencesState, FormData>(savePreferences, {
    status: "idle",
  });

  return (
    <form action={action} className="grid gap-5 rounded-xl border border-border bg-surface p-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="preferredBracket" className="text-sm font-medium">
            Rank
          </label>
          <select
            id="preferredBracket"
            name="preferredBracket"
            defaultValue={defaults.preferredBracket}
            className={selectClass}
            aria-describedby="preferredBracket-help"
          >
            <option value={0}>Use my rank ({rankLabel})</option>
            {BRACKETS.slice(1).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <p id="preferredBracket-help" className="text-xs text-muted">
            Meta stats are shown for this rank.
          </p>
        </div>

        <div className="grid gap-2">
          <label htmlFor="preferredPosition" className="text-sm font-medium">
            Main position
          </label>
          <select
            id="preferredPosition"
            name="preferredPosition"
            defaultValue={defaults.preferredPosition}
            className={selectClass}
          >
            {POSITIONS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id === 0 ? "Any position" : p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save preferences"}
        </Button>
        <p aria-live="polite" className="flex items-center gap-1.5 text-sm">
          {state.status === "saved" ? (
            <>
              <CheckCircle size={18} weight="fill" aria-hidden className="text-radiant" />
              {state.message}
            </>
          ) : state.status === "error" ? (
            <>
              <WarningCircle size={18} weight="fill" aria-hidden className="text-danger" />
              {state.message}
            </>
          ) : null}
        </p>
      </div>
    </form>
  );
}
