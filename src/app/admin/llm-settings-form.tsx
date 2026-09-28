"use client";

import { useActionState, useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { LlmSettings } from "@/lib/llm/settings";
import { saveLlmSettingsAction, testLlmModel, type LlmFormState } from "./llm-actions";

export interface ProviderOption {
  id: string;
  label: string;
  envVar: string;
  configured: boolean;
  models: { id: string; label: string }[];
}

const fieldClass =
  "h-10 w-full rounded-md border border-border bg-surface px-3 text-base focus:border-accent-fg focus:outline-none sm:text-sm";

const ROW_LABEL = ["Primary", "Fallback 1", "Fallback 2"];

export function LlmSettingsForm({
  settings,
  providers,
}: {
  settings: LlmSettings;
  providers: ProviderOption[];
}) {
  const [state, action, pending] = useActionState<LlmFormState, FormData>(saveLlmSettingsAction, {
    status: "idle",
  });
  const ids = { enabled: useId(), perUser: useId(), global: useId(), status: useId() };

  return (
    <form
      action={action}
      className="grid gap-5 rounded-lg border border-border bg-surface p-4 sm:p-5"
    >
      <label htmlFor={ids.enabled} className="flex w-fit cursor-pointer items-center gap-2 text-sm">
        <input
          id={ids.enabled}
          name="enabled"
          type="checkbox"
          defaultChecked={settings.enabled}
          className="size-4 accent-[var(--accent)]"
        />
        Coaching notes are on
      </label>

      <div className="grid gap-3">
        <p className="text-sm font-medium">Model order</p>
        {ROW_LABEL.map((label, i) => (
          <ChainRow
            key={label}
            index={i}
            label={label}
            initial={settings.chain[i] ?? null}
            providers={providers}
          />
        ))}
        <p className="text-xs text-muted">
          Each request tries these in order and skips providers without an API key. If every one
          fails, players get the plain version. Model names can be typed in if a provider adds new
          ones.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor={ids.perUser} className="text-sm font-medium">
            New notes per player per day
          </label>
          <input
            id={ids.perUser}
            name="perUserPerDay"
            type="number"
            min={0}
            max={1000}
            defaultValue={settings.perUserPerDay}
            className={fieldClass}
          />
        </div>
        <div className="grid gap-2">
          <label htmlFor={ids.global} className="text-sm font-medium">
            New notes per day, all players
          </label>
          <input
            id={ids.global}
            name="globalPerDay"
            type="number"
            min={0}
            max={100000}
            defaultValue={settings.globalPerDay}
            className={fieldClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending} aria-describedby={ids.status}>
          {pending ? "Saving..." : "Save"}
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

function ChainRow({
  index,
  label,
  initial,
  providers,
}: {
  index: number;
  label: string;
  initial: { provider: string; model: string } | null;
  providers: ProviderOption[];
}) {
  const [provider, setProvider] = useState(initial?.provider ?? "none");
  const [model, setModel] = useState(initial?.model ?? "");
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, startTest] = useTransition();
  const ids = { provider: useId(), model: useId(), list: useId() };
  const current = providers.find((p) => p.id === provider);

  return (
    <fieldset className="grid gap-2 rounded-md border border-border p-3">
      <legend className="px-1 text-xs text-muted">{label}</legend>
      <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
        <div className="grid gap-1">
          <label htmlFor={ids.provider} className="text-xs text-muted">
            Provider
          </label>
          <select
            id={ids.provider}
            name={`provider${index}`}
            value={provider}
            onChange={(e) => {
              const next = e.target.value;
              setProvider(next);
              setModel(providers.find((p) => p.id === next)?.models[0]?.id ?? "");
              setTest(null);
            }}
            className={fieldClass}
          >
            <option value="none">None</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.configured ? "" : " (no key)"}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1">
          <label htmlFor={ids.model} className="text-xs text-muted">
            Model
          </label>
          <input
            id={ids.model}
            name={`model${index}`}
            list={ids.list}
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              setTest(null);
            }}
            disabled={provider === "none"}
            className={fieldClass}
          />
          <datalist id={ids.list}>
            {current?.models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </datalist>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={provider === "none" || !model || testing}
          onClick={() => startTest(async () => setTest(await testLlmModel(provider, model)))}
        >
          {testing ? "Testing..." : "Test"}
        </Button>
      </div>
      {current && !current.configured ? (
        <p className="text-xs text-muted">
          {current.envVar} isn&apos;t set, so this row is skipped for now.
        </p>
      ) : null}
      {test ? (
        <p
          role="status"
          className={test.ok ? "text-xs break-words" : "text-xs break-words text-danger"}
        >
          {test.ok ? "Works: " : "Failed: "}
          {test.message}
        </p>
      ) : null}
    </fieldset>
  );
}
