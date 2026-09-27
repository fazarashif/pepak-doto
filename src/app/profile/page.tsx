import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react/ssr";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getCurrentUser } from "@/lib/auth/session";
import { rankTierLabel } from "@/lib/dota";
import { DeleteAccount } from "./delete-account";
import { PreferencesForm } from "./preferences-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/profile");

  const rank = rankTierLabel(user.rankTier);

  return (
    <div className="mx-auto grid max-w-3xl gap-12 px-4 pt-10 sm:px-6">
      <section className="flex flex-wrap items-center gap-5">
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" width={80} height={80} className="size-20 rounded-xl" />
        ) : null}
        <div className="grid gap-1">
          <h1 className="text-3xl font-semibold tracking-tight">{user.personaName}</h1>
          <p className="text-muted">
            {rank}
            <span className="px-2" aria-hidden>
              ·
            </span>
            <span className="font-mono text-sm tabular-nums">Account {user.accountId}</span>
          </p>
          {user.profileUrl ? (
            <a
              href={user.profileUrl}
              className="flex w-fit items-center gap-1 text-sm text-accent-fg underline-offset-4 hover:underline"
            >
              Steam profile
              <ArrowSquareOut size={14} aria-hidden />
            </a>
          ) : null}
        </div>
      </section>

      {user.rankTier == null ? (
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-relaxed">
          We couldn&apos;t find a rank for this account. If you play ranked, your match data is
          probably private. Turn on <span className="font-medium">Expose Public Match Data</span> in
          the Dota 2 settings, play a match, and your rank will show up here after that.
        </p>
      ) : null}

      <section aria-labelledby="prefs" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="prefs" className="text-xl font-semibold tracking-tight">
            Preferences
          </h2>
          <p className="text-sm text-muted">
            Used as the default rank and position in the draft assistant.
          </p>
        </div>
        <PreferencesForm
          rankLabel={rank}
          defaults={{
            preferredBracket: user.preferredBracket,
            preferredPosition: user.preferredPosition,
          }}
        />
      </section>

      <section aria-labelledby="account" className="grid gap-4 border-t border-border pt-8">
        <h2 id="account" className="text-xl font-semibold tracking-tight">
          Account
        </h2>
        <div className="flex flex-wrap items-start gap-3">
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              Sign out
            </Button>
          </form>
        </div>
        <DeleteAccount />
      </section>
    </div>
  );
}
