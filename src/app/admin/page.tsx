import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { count } from "drizzle-orm";
import { CheckCircle, MinusCircle, WarningCircle } from "@phosphor-icons/react/ssr";
import { getCurrentUser, isAdmin, isAuthConfigured } from "@/lib/auth/session";
import { getDb, schema } from "@/lib/db";
import { isStratzConfigured } from "@/lib/stratz/client";
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
  try {
    const db = await getDb();
    const [row] = await db.select({ n: count() }).from(schema.users);
    userCount = row.n;
    usage = await recentUsage(7);
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
    { name: "LLM providers", status: "off", detail: "Configured in stage 4." },
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
