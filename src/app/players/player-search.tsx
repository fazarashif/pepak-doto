"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { parsePlayerInput } from "@/lib/players/id";

export function PlayerSearch() {
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
        const id = parsePlayerInput(value);
        if (!id) {
          setError(
            "Enter a Friend ID (like 123456789) or paste an OpenDota, Dotabuff, STRATZ or Steam profile link. Steam links with a custom name don't work, use the number instead.",
          );
          return;
        }
        setError(null);
        setPending(true);
        router.push(`/players/${id}`);
      }}
      className="grid gap-2"
    >
      <label htmlFor={inputId} className="text-sm font-medium">
        Friend ID or profile link
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="off"
          placeholder="123456789"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="h-11 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-base placeholder:text-muted/80 focus:border-accent-fg focus:outline-none aria-[invalid=true]:border-danger sm:text-sm"
        />
        <Button type="submit" disabled={pending}>
          {pending ? "Opening..." : "Open profile"}
        </Button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted">
          The Friend ID is shown on your Dota 2 profile page, under your name.
        </p>
      )}
    </form>
  );
}
