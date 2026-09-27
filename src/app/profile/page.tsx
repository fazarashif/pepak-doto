import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArrowSquareOut } from "@phosphor-icons/react/ssr";
import { MaskedSvg } from "@/components/brand";
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
          <img src={user.avatarUrl} alt="" width={80} height={80} className="size-20 rounded-lg" />
        ) : null}
        <div className="grid gap-1">
          <h1 className="font-display text-3xl font-bold">{user.personaName}</h1>
          <div className="flex flex-wrap items-center gap-3 text-muted">
            <span className="inline-flex items-center gap-1.5 rounded-sm border border-border-strong px-2 py-0.5 font-display-sc text-sm font-bold text-fg">
              <MaskedSvg src="/brand/logo-symbol-small.svg" className="size-4 text-accent" />
              {rank}
            </span>
            <span className="font-mono text-sm tabular-nums">Account {user.accountId}</span>
          </div>
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
        <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-relaxed">
          We couldn&apos;t find a rank for this account. If you play ranked, your match data is
          probably private. Turn on <span className="font-medium">Expose Public Match Data</span> in
          the Dota 2 settings, play a match, and your rank will show up here after that.
        </p>
      ) : null}

      <section aria-labelledby="prefs" className="grid gap-4">
        <div className="grid gap-1">
          <h2 id="prefs" className="font-display text-xl font-bold">
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
        <h2 id="account" className="font-display text-xl font-bold">
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
