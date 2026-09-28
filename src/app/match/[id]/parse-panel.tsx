"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { checkParsed, requestParse } from "./actions";

const POLL_MS = 30_000;
const GIVE_UP_MS = 30 * 60_000;
/** Valve biasanya hanya menyimpan replay sekitar dua minggu. */
const REPLAY_DAYS = 14;

const storageKey = (matchId: number) => `pd-parse:${matchId}`;
const noSubscribe = () => () => {};

/** Waktu parse diminta (dari sessionStorage), supaya status menunggu tetap ada setelah refresh. */
function readStarted(matchId: number): number | null {
  try {
    const value = Number(sessionStorage.getItem(storageKey(matchId)));
    return value && Date.now() - value < GIVE_UP_MS ? value : null;
  } catch {
    return null;
  }
}

function writeStarted(matchId: number, value: number | null) {
  try {
    if (value) sessionStorage.setItem(storageKey(matchId), String(value));
    else sessionStorage.removeItem(storageKey(matchId));
  } catch {
    // sessionStorage bisa diblokir; fitur tetap jalan tanpa itu
  }
}

function formatWait(ms: number) {
  const minutes = Math.floor(ms / 60_000);
  return minutes < 1 ? "less than a minute" : minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

/**
 * Tombol parse replay. Setelah diminta, OpenDota dicek berkala tanpa cache; begitu replay
 * selesai di-parse, halaman di-refresh.
 */
export function ParsePanel({ matchId, startTime }: { matchId: number; startTime: number }) {
  const router = useRouter();
  const stored = useSyncExternalStore(
    noSubscribe,
    () => readStarted(matchId),
    () => null,
  );
  const [requestedAt, setRequestedAt] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "requesting" | "timeout" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const startedAt = requestedAt ?? stored;
  const waiting = startedAt !== null && status !== "timeout" && status !== "requesting";
  const ageDays = (now / 1000 - startTime) / 86_400;

  useEffect(() => {
    if (!waiting || startedAt === null) return;
    let stopped = false;
    const clock = setInterval(() => setNow(Date.now()), 15_000);
    const poll = setInterval(async () => {
      if (Date.now() - startedAt > GIVE_UP_MS) {
        writeStarted(matchId, null);
        setStatus("timeout");
        return;
      }
      if ((await checkParsed(matchId)) && !stopped) {
        writeStarted(matchId, null);
        router.refresh();
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [waiting, startedAt, matchId, router]);

  async function start() {
    setStatus("requesting");
    setMessage(null);
    const result = await requestParse(matchId);
    if (!result.ok) {
      setMessage(result.message ?? null);
      setStatus("error");
      return;
    }
    const started = Date.now();
    writeStarted(matchId, started);
    setRequestedAt(started);
    setNow(started);
    setStatus("idle");
  }

  return (
    <div className="grid justify-items-start gap-3 rounded-lg border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold">Get the full breakdown</h2>
      <p className="max-w-[62ch] text-sm text-muted">
        Laning, deaths, item timings and vision come from the replay, and OpenDota hasn&apos;t
        processed this one yet. Requests go into OpenDota&apos;s public queue, so it can take a few
        minutes or a lot longer when the queue is busy. You can leave this page open or come back
        later.
      </p>
      {ageDays > REPLAY_DAYS ? (
        <p className="max-w-[62ch] text-sm">
          This match is {Math.floor(ageDays)} days old. Valve usually keeps replays for about two
          weeks, so it may not be possible to parse it anymore.
        </p>
      ) : null}

      {waiting && startedAt !== null ? (
        <p role="status" className="text-sm">
          Waiting for OpenDota ({formatWait(now - startedAt)} so far). This page updates by itself
          when the replay is ready.
        </p>
      ) : status === "timeout" ? (
        <div className="grid justify-items-start gap-2">
          <p role="status" className="text-sm">
            OpenDota still hasn&apos;t finished after 30 minutes. The replay may be unavailable, or
            the queue is very long. You can ask again or check back later.
          </p>
          <Button variant="secondary" onClick={start}>
            Ask again
          </Button>
        </div>
      ) : (
        <Button onClick={start} disabled={status === "requesting"}>
          {status === "requesting" ? "Requesting..." : "Parse replay"}
        </Button>
      )}

      {status === "error" && message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : null}
    </div>
  );
}
