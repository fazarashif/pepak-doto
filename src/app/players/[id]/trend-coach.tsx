"use client";

import { useState, useTransition } from "react";
import { CoachFrame } from "@/components/coach-frame";
import { Button } from "@/components/ui/button";
import type { SuggestedGoal, TrendSummary } from "@/lib/llm/prompts/trend-summary";
import type { CoachResult } from "@/lib/llm/result";
import { goalText } from "@/lib/players/goals";
import { addSuggestedGoal } from "./goal-actions";
import { requestTrendSummary } from "./trend-actions";

export function TrendCoach({
  accountId,
  size,
  initial,
  signedIn,
  isOwner,
}: {
  accountId: number;
  size: number;
  initial: CoachResult<TrendSummary> | null;
  signedIn: boolean;
  isOwner: boolean;
}) {
  return (
    <CoachFrame
      title="Coach's summary"
      intro={`What matters most in these ${size} games, and one practice goal to work on next.`}
      buttonLabel="Get a summary"
      initial={initial}
      signedIn={signedIn}
      signInNext={`/players/${accountId}${size === 20 ? "?n=20" : ""}`}
      request={() => requestTrendSummary(accountId, size)}
      render={(s) => (
        <div className="grid gap-3">
          <p className="leading-relaxed">{s.summary}</p>
          {s.goal ? <GoalSuggestion goal={s.goal} reason={s.goalReason} canAdd={isOwner} /> : null}
        </div>
      )}
    />
  );
}

function GoalSuggestion({
  goal,
  reason,
  canAdd,
}: {
  goal: SuggestedGoal;
  reason: string | null;
  canAdd: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid justify-items-start gap-2 rounded-md border border-accent-fg p-3">
      <p className="text-xs text-muted">Suggested goal</p>
      <p className="font-display text-lg font-bold">{goalText(goal)}</p>
      {reason ? <p className="text-sm">{reason}</p> : null}
      {canAdd ? (
        <Button
          size="sm"
          variant="secondary"
          disabled={pending || message !== null}
          onClick={() =>
            startTransition(async () => {
              const res = await addSuggestedGoal(goal);
              setMessage(res.message ?? null);
            })
          }
        >
          {pending ? "Adding..." : "Add this goal"}
        </Button>
      ) : null}
      {message ? (
        <p role="status" className="text-sm text-muted">
          {message}
        </p>
      ) : null}
    </div>
  );
}
