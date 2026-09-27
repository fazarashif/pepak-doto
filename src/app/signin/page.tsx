import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SteamLogo } from "@phosphor-icons/react/ssr";
import { buttonStyles } from "@/components/ui/button";
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
    <div className="mx-auto grid max-w-md gap-6 px-4 pt-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm"
        >
          {error}
        </p>
      ) : null}

      <p className="leading-relaxed text-muted">
        You&apos;ll be sent to Steam to confirm it&apos;s you. We never see your password. Steam
        only tells us your Steam ID, which we use to find your public Dota matches.
      </p>

      <Link
        href={`/api/auth/steam?next=${encodeURIComponent(next)}`}
        prefetch={false}
        className={buttonStyles({ size: "lg" })}
      >
        <SteamLogo size={20} weight="fill" aria-hidden />
        Sign in with Steam
      </Link>

      <p className="text-sm text-muted">
        You can use the draft assistant and match review without an account. See the{" "}
        <Link href="/privacy" className="text-accent-fg underline-offset-4 hover:underline">
          privacy policy
        </Link>{" "}
        for what we store.
      </p>
    </div>
  );
}
