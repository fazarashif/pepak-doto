"use client";

import { CoachFrame } from "@/components/coach-frame";
import type { MatchNotes } from "@/lib/llm/prompts/match-notes";
import type { CoachResult } from "@/lib/llm/result";
import { requestMatchNotes } from "./actions";

export function MatchCoach({
  matchId,
  slot,
  initial,
  signedIn,
}: {
  matchId: number;
  slot: number;
  initial: CoachResult<MatchNotes> | null;
  signedIn: boolean;
}) {
  return (
    <CoachFrame
      title="Coach's notes"
      intro="A short write-up of this match: what cost you the most, and one thing to practice in your next game for each."
      buttonLabel="Get coaching notes"
      initial={initial}
      signedIn={signedIn}
      signInNext={`/match/${matchId}?slot=${slot}`}
      request={() => requestMatchNotes(matchId, slot)}
      render={(notes) => (
        <div className="grid gap-4">
          <p className="leading-relaxed">{notes.summary}</p>
          {notes.focus.length ? (
            <ol className="grid gap-3">
              {notes.focus.map((f, i) => (
                <li key={f.title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-2">
                  <span className="grid size-7 place-items-center rounded-full bg-accent font-mono text-sm text-on-accent">
                    {i + 1}
                  </span>
                  <div className="grid gap-1">
                    <p className="font-display text-lg font-bold">{f.title}</p>
                    <p className="text-sm">{f.why}</p>
                    <p className="text-sm">
                      <span className="font-medium text-accent-fg">Next game: </span>
                      {f.drill}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : null}
          {notes.keepDoing ? (
            <p className="text-sm">
              <span className="font-medium text-accent-fg">Keep doing: </span>
              {notes.keepDoing}
            </p>
          ) : null}
        </div>
      )}
    />
  );
}
