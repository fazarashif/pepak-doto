"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { parseMatchId } from "@/lib/match/id";

export function MatchIdForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputId = useId();
  const errorId = useId();

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        const id = parseMatchId(value);
        if (!id) {
          setError("Enter a match ID (a number like 8123456789) or paste a match link.");
          return;
        }
        setError(null);
        setPending(true);
        router.push(`/match/${id}`);
      }}
      className="grid gap-2"
    >
      <label htmlFor={inputId} className="text-sm font-medium">
        Match ID or link
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="8123456789"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base placeholder:text-muted/80 focus:border-accent-fg focus:outline-none aria-[invalid=true]:border-danger sm:text-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Opening..." : "Review match"}
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted">Links from OpenDota, Dotabuff and STRATZ work too.</p>
      )}
    </form>
  );
}
