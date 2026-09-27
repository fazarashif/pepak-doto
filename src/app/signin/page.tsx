import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoSymbol } from "@/components/brand";
import { SteamSignIn } from "@/components/steam-sign-in";
import { safeNextPath } from "@/lib/auth/redirect";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  expired: "The sign-in took too long or was started in another tab. Please try again.",
  invalid: "Steam couldn't confirm the sign-in. Please try again.",
  steam: "We couldn't reach Steam. It may be down for a moment, so try again shortly.",
  server: "Something went wrong on our side while signing you in. Please try again.",
  config: "Sign-in isn't set up on this server yet.",
};

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  if (await getCurrentUser()) redirect(next);

  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <div className="batik batik-truntum batik-reveal px-4 py-12 sm:py-20">
      <div className="mx-auto grid max-w-md gap-6 rounded-lg border border-border bg-surface p-6 shadow-2 sm:p-8">
        <div className="flex items-center gap-3">
          <LogoSymbol className="size-10" />
          <h1 className="font-display text-3xl font-bold">Sign in</h1>
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm"
          >
            {error}
          </p>
        ) : null}

        <p className="leading-relaxed text-muted">
          You&apos;ll be sent to Steam to confirm it&apos;s you. We never see your password. Steam
          only tells us your Steam ID, which we use to find your public Dota matches.
        </p>

        <SteamSignIn next={next} size="lg" />

        <p className="text-sm text-muted">
          You can use the draft assistant and match review without an account. See the{" "}
          <Link href="/privacy" className="text-accent-fg underline-offset-4 hover:underline">
            privacy policy
          </Link>{" "}
          for what we store.
        </p>
      </div>
    </div>
  );
}
