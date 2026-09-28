import type { Metadata } from "next";
import { Fragment } from "react";
import { notFound } from "next/navigation";
import { count } from "drizzle-orm";
import { CheckCircle, MinusCircle, WarningCircle } from "@phosphor-icons/react/ssr";
import { getCurrentUser, isAdmin, isAuthConfigured } from "@/lib/auth/session";
import { cn } from "@/lib/cn";
import { getDb, schema } from "@/lib/db";
import { getSyncStatus } from "@/lib/hero-data/store";
import type { SyncStatus } from "@/lib/hero-data/write";
import { PROVIDERS } from "@/lib/llm/providers";
import { getLlmSettings, llmUsageReport, narrativesToday } from "@/lib/llm/router";
import { isStratzConfigured } from "@/lib/stratz/client";
import { LlmSettingsForm } from "./llm-settings-form";
import { recentUsage } from "@/lib/usage";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

type Status = "ok" | "off" | "error";

interface ServiceRow {
  name: string;
  status: Status;
  detail: string;
}

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) notFound();

  let userCount: number | null = null;
  let dbError: string | null = null;
  let usage: Awaited<ReturnType<typeof recentUsage>> = [];
  let sync: SyncStatus | null = null;
  let llmUsage: Awaited<ReturnType<typeof llmUsageReport>> = [];
  let notesToday = 0;
  const llmSettings = await getLlmSettings();
  try {
    const db = await getDb();
    const [row] = await db.select({ n: count() }).from(schema.users);
    userCount = row.n;
    usage = await recentUsage(7);
    sync = await getSyncStatus();
    llmUsage = await llmUsageReport(7);
    notesToday = await narrativesToday();
  } catch (err) {
    dbError = err instanceof Error ? err.message : "Unknown error";
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayFor = (provider: string) =>
    usage.find((u) => u.day === today && u.provider === provider);
  const quota = (provider: string, limit: string) => {
    const row = todayFor(provider);
    if (!row) return `No requests today. Free limit ${limit}.`;
    const left = row.remaining != null ? `, ${row.remaining.toLocaleString("en-US")} left` : "";
    return `${row.requests} requests today${left}.`;
  };

  const providerOptions = Object.values(PROVIDERS).map((p) => ({
    id: p.id,
    label: p.label,
    envVar: p.envVar,
    configured: p.isConfigured(),
    models: p.models.map((m) => ({ id: m.id, label: m.label })),
  }));

  const services: ServiceRow[] = [
    {
      name: "Database",
      status: dbError ? "error" : "ok",
      detail: dbError
        ? dbError
        : `${process.env.DATABASE_URL ? "Neon" : "Local PGlite"}, ${userCount} users.`,
    },
    { name: "OpenDota", status: "ok", detail: quota("opendota", "3,000/day") },
    {
      name: "STRATZ",
      status: isStratzConfigured() ? "ok" : "off",
      detail: isStratzConfigured() ? quota("stratz", "15,000/day") : "STRATZ_TOKEN is not set.",
    },
    heroDataRow(sync),
    {
      name: "Steam Web API",
      status: process.env.STEAM_WEB_API_KEY ? "ok" : "off",
      detail: process.env.STEAM_WEB_API_KEY
        ? "Used for names and avatars at sign-in."
        : "Optional. Names and avatars come from OpenDota instead.",
    },
    {
      name: "Sessions",
      status: isAuthConfigured() ? "ok" : "error",
      detail: isAuthConfigured()
        ? "SESSION_SECRET is set."
        : "SESSION_SECRET is missing or too short.",
    },
    llmRow(llmSettings.enabled, notesToday, llmSettings.globalPerDay),
  ];

  return (
    <div className="mx-auto grid max-w-4xl gap-10 px-4 pt-10 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Admin</h1>

      <section aria-labelledby="services" className="grid gap-3">
        <h2 id="services" className="font-display text-lg font-bold">
          Services
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {services.map((s) => (
            <li key={s.name} className="flex gap-3 rounded-lg border border-border bg-surface p-4">
              <StatusIcon status={s.status} />
              <div className="grid min-w-0 gap-0.5">
                <p className="font-medium">{s.name}</p>
                <p className="text-sm break-words text-muted">{s.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="llm" className="grid gap-3">
        <div className="grid gap-1">
          <h2 id="llm" className="font-display text-lg font-bold">
            Coaching notes (LLM)
          </h2>
          <p className="text-sm text-muted">
            API keys live in the environment variables; set them in Vercel and redeploy.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-3">
          {providerOptions.map((p) => (
            <li key={p.id} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
              <StatusIcon status={p.configured ? "ok" : "off"} />
              <div className="grid min-w-0 gap-0.5">
                <p className="text-sm font-medium">{p.label}</p>
                <p className="font-mono text-xs break-words text-muted">
                  {p.envVar} {p.configured ? "set" : "not set"}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <LlmSettingsForm settings={llmSettings} providers={providerOptions} />
        <LlmUsageTable rows={llmUsage} />
      </section>

      <section aria-labelledby="usage" className="grid gap-3">
        <h2 id="usage" className="font-display text-lg font-bold">
          API requests, last 7 days
        </h2>
        {usage.length === 0 ? (
          <p className="text-sm text-muted">No requests recorded yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-muted">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Day
                  </th>
                  <th scope="col" className="px-4 py-2 font-medium">
                    Service
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Requests
                  </th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">
                    Quota left
                  </th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {usage.map((u) => (
                  <tr key={`${u.day}-${u.provider}`} className="border-t border-border">
                    <td className="px-4 py-2">{u.day}</td>
                    <td className="px-4 py-2 font-sans">{u.provider}</td>
                    <td className="px-4 py-2 text-right">{u.requests}</td>
                    <td className="px-4 py-2 text-right">{u.remaining ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function llmRow(enabled: boolean, today: number, limit: number): ServiceRow {
  const configured = Object.values(PROVIDERS).filter((p) => p.isConfigured());
  return {
    name: "Coaching notes",
    status: !enabled || !configured.length ? "off" : "ok",
    detail: !enabled
      ? "Turned off. Players get the plain version."
      : configured.length
        ? `${configured.map((p) => p.label).join(", ")}. ${today} of ${limit} new notes today.`
        : "No API key set yet. Players get the plain version.",
  };
}

function LlmUsageTable({ rows }: { rows: Awaited<ReturnType<typeof llmUsageReport>> }) {
  if (!rows.length)
    return <p className="text-sm text-muted">No coaching notes requested in the last 7 days.</p>;
  const total = rows.reduce((s, r) => s + r.costUsd, 0);
  return (
    <div className="grid gap-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-left text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">
                Day
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Model
              </th>
              <th scope="col" className="px-3 py-2 font-medium">
                Feature
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Requests
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Failed
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Tokens in/out
              </th>
              <th scope="col" className="px-3 py-2 text-right font-medium">
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {rows.map((r) => (
              <Fragment key={`${r.day}-${r.provider}-${r.model}-${r.feature}`}>
                <tr className="border-t border-border">
                  <td className="px-3 py-2">{r.day}</td>
                  <td className="px-3 py-2 font-sans">{r.model}</td>
                  <td className="px-3 py-2 font-sans">{r.feature}</td>
                  <td className="px-3 py-2 text-right">{r.requests}</td>
                  <td className={cn("px-3 py-2 text-right", r.failures && "text-danger")}>
                    {r.failures}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {r.inputTokens.toLocaleString("en-US")}/{r.outputTokens.toLocaleString("en-US")}
                  </td>
                  <td className="px-3 py-2 text-right">${r.costUsd.toFixed(3)}</td>
                </tr>
                {r.failures && r.lastError ? (
                  <tr>
                    <td colSpan={7} className="px-3 pb-2 font-sans text-xs break-words text-danger">
                      Last error: {r.lastError}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">Estimated cost over 7 days: ${total.toFixed(2)}.</p>
    </div>
  );
}

function heroDataRow(sync: SyncStatus | null): ServiceRow {
  const name = "Hero data sync";
  if (!sync) {
    return {
      name,
      status: "off",
      detail: "Never ran. It runs daily on GitHub Actions, or with npm run sync:hero-data.",
    };
  }
  const hours = Math.round((Date.now() - new Date(sync.finishedAt).getTime()) / 3_600_000);
  const when =
    hours < 1 ? "less than an hour ago" : hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  const errors = sync.errors.length ? ` ${sync.errors.length} error(s): ${sync.errors[0]}` : "";
  return {
    name,
    // Lebih dari 2 hari tanpa sinkron berarti jadwal harian berhenti.
    status: !sync.ok || hours > 48 ? "error" : "ok",
    detail: `Last run ${when}, ${sync.rows.toLocaleString("en-US")} rows, ${sync.stratzRequests} STRATZ requests.${errors}`,
  };
}

function StatusIcon({ status }: { status: Status }) {
  if (status === "ok") {
    return (
      <CheckCircle
        size={22}
        weight="fill"
        className="shrink-0 text-accent-fg"
        aria-label="Working"
      />
    );
  }
  if (status === "error") {
    return (
      <WarningCircle
        size={22}
        weight="fill"
        className="shrink-0 text-danger"
        aria-label="Problem"
      />
    );
  }
  return (
    <MinusCircle size={22} weight="fill" className="shrink-0 text-muted" aria-label="Not set up" />
  );
}
