"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestParse } from "./actions";

const POLL_MS = 10_000;
const GIVE_UP_MS = 5 * 60_000;

/** Tombol parse replay. Setelah diminta, halaman di-refresh berkala sampai laporan lengkap muncul. */
export function ParsePanel({ matchId }: { matchId: number }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "requesting" | "waiting" | "timeout" | "error">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (state !== "waiting") return;
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        setState("timeout");
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state, router]);

  async function start() {
    setState("requesting");
    const result = await requestParse(matchId);
    if (result.ok) {
      setState("waiting");
    } else {
      setMessage(result.message ?? null);
      setState("error");
    }
  }

  return (
    <div className="grid justify-items-start gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold">Get the full breakdown</h2>
      <p className="max-w-[60ch] text-sm text-muted">
        Laning, deaths, item timings and vision come from the replay. OpenDota hasn&apos;t processed
        this one yet. It usually takes one to five minutes, and replays older than a couple of weeks
        may no longer be available.
      </p>
      {state === "waiting" ? (
        <p role="status" className="text-sm">
          Processing the replay. This page updates by itself when it&apos;s ready.
        </p>
      ) : state === "timeout" ? (
        <p role="status" className="text-sm">
          This is taking longer than usual. Refresh the page later to check again.
        </p>
      ) : (
        <Button onClick={start} disabled={state === "requesting"}>
          {state === "requesting" ? "Requesting..." : "Parse replay"}
        </Button>
      )}
      {state === "error" && message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
