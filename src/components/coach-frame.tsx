"use client";

import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react";
import { SteamSignIn } from "@/components/steam-sign-in";
import { Button } from "@/components/ui/button";
import type { CoachResult } from "@/lib/llm/result";

/**
 * Bingkai narasi coaching: tampilkan narasi tersimpan, atau tombol untuk membuatnya.
 * Membuat narasi baru butuh login (PRD D32); tamu hanya bisa membaca yang sudah ada.
 */
export function CoachFrame<T>({
  title,
  intro,
  buttonLabel,
  initial,
  signedIn,
  signInNext,
  request,
  render,
}: {
  title: string;
  intro: string;
  buttonLabel: string;
  initial: CoachResult<T> | null;
  signedIn: boolean;
  signInNext: string;
  request: () => Promise<CoachResult<T>>;
  render: (content: T) => React.ReactNode;
}) {
  const [result, setResult] = useState<CoachResult<T> | null>(initial);
  const [pending, startTransition] = useTransition();

  function ask() {
    startTransition(async () => {
      try {
        setResult(await request());
      } catch {
        setResult({ ok: false, message: "Something went wrong. Try again in a moment." });
      }
    });
  }

  return (
    <section
      aria-label={title}
      aria-busy={pending}
      className="grid gap-3 rounded-lg border border-border bg-surface p-5"
    >
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Sparkle size={20} weight="fill" aria-hidden className="text-accent-fg" />
        {title}
      </h2>

      {result?.ok ? (
        <div className="grid gap-3">
          {result.note ? (
            <p role="status" className="rounded-md bg-surface-2 px-3 py-2 text-sm">
              {result.note}
            </p>
          ) : null}
          {render(result.content)}
          {!result.by && signedIn ? (
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={ask}
              disabled={pending}
            >
              {pending ? "Trying..." : "Try again"}
            </Button>
          ) : null}
          <p className="text-xs text-muted">
            {result.by
              ? `Written by ${result.by} from the numbers on this page. It can still get things wrong.`
              : "Put together from the numbers on this page."}
          </p>
        </div>
      ) : pending ? (
        <p role="status" className="text-sm text-muted">
          Writing your notes. This takes a few seconds...
        </p>
      ) : (
        <div className="grid justify-items-start gap-3">
          <p className="max-w-[62ch] text-sm text-muted">{intro}</p>
          {signedIn ? (
            <Button onClick={ask}>{buttonLabel}</Button>
          ) : (
            <div className="grid justify-items-start gap-2">
              <p className="text-sm">Sign in to get coaching notes.</p>
              <SteamSignIn next={signInNext} size="sm" />
            </div>
          )}
          {result && !result.ok ? (
            <p role="alert" className="text-sm text-danger">
              {result.message}
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
