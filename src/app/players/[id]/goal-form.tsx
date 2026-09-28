"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { GOAL_METRICS, type Direction, type GoalMetric } from "@/lib/players/goals";
import { createGoal, type GoalFormState } from "./goal-actions";

const fieldClass =
  "h-11 w-full rounded-md border border-border bg-surface px-3 text-base focus:border-accent-fg focus:outline-none sm:text-sm";

const METRIC_KEYS = Object.keys(GOAL_METRICS) as GoalMetric[];

export function GoalForm({ heroes }: { heroes: { id: number; name: string }[] }) {
  const [state, action, pending] = useActionState<GoalFormState, FormData>(createGoal, {
    status: "idle",
  });
  const [metric, setMetric] = useState<GoalMetric>("deaths");
  const [direction, setDirection] = useState<Direction>(GOAL_METRICS.deaths.direction);
  const def = GOAL_METRICS[metric];
  const isWin = metric === "win";
  const ids = {
    metric: useId(),
    direction: useId(),
    target: useId(),
    games: useId(),
    hero: useId(),
    status: useId(),
  };

  return (
    <form
      action={action}
      className="grid gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <h3 className="font-display text-lg font-bold">New goal</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <label htmlFor={ids.metric} className="text-sm font-medium">
            What to track
          </label>
          <select
            id={ids.metric}
            name="metric"
            value={metric}
            onChange={(e) => {
              const m = e.target.value as GoalMetric;
              setMetric(m);
              setDirection(GOAL_METRICS[m].direction);
            }}
            className={fieldClass}
          >
            <optgroup label="Every match">
              {METRIC_KEYS.filter((k) => !GOAL_METRICS[k].needsReplay).map((k) => (
                <option key={k} value={k}>
                  {GOAL_METRICS[k].label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Needs a parsed replay">
              {METRIC_KEYS.filter((k) => GOAL_METRICS[k].needsReplay).map((k) => (
                <option key={k} value={k}>
                  {GOAL_METRICS[k].label}
                </option>
              ))}
            </optgroup>
          </select>
          {def.needsReplay ? (
            <p className="text-xs text-muted">
              Only matches with a parsed replay count. Your new matches are sent for parsing every
              day, so results can show up a few hours late.
            </p>
          ) : null}
        </div>

        {isWin ? (
          <>
            <input type="hidden" name="direction" value="atLeast" />
            <input type="hidden" name="target" value="1" />
          </>
        ) : (
          <>
            <div className="grid gap-2">
              <label htmlFor={ids.direction} className="text-sm font-medium">
                Direction
              </label>
              <select
                id={ids.direction}
                name="direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value as Direction)}
                className={fieldClass}
              >
                <option value="atLeast">At least</option>
                <option value="atMost">At most</option>
              </select>
            </div>
            <div className="grid gap-2">
              <label htmlFor={ids.target} className="text-sm font-medium">
                Target{def.unit ? ` (${def.unit.replace("/", "per ").trim()})` : ""}
              </label>
              <input
                key={metric}
                id={ids.target}
                name="target"
                type="number"
                inputMode="decimal"
                min={0}
                step={def.step}
                defaultValue={def.example}
                required
                className={fieldClass}
              />
            </div>
          </>
        )}

        <div className="grid gap-2">
          <label htmlFor={ids.games} className="text-sm font-medium">
            Number of games
          </label>
          <input
            id={ids.games}
            name="games"
            type="number"
            inputMode="numeric"
            min={1}
            max={50}
            defaultValue={5}
            required
            className={fieldClass}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor={ids.hero} className="text-sm font-medium">
            Hero <span className="font-normal text-muted">(optional)</span>
          </label>
          <select id={ids.hero} name="heroId" defaultValue="" className={fieldClass}>
            <option value="">Any hero</option>
            {heroes.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} aria-describedby={ids.status}>
          {pending ? "Saving..." : "Add goal"}
        </Button>
        <p
          id={ids.status}
          role={state.status === "error" ? "alert" : "status"}
          className={state.status === "error" ? "text-sm text-danger" : "text-sm text-muted"}
        >
          {state.message}
        </p>
      </div>
    </form>
  );
}
