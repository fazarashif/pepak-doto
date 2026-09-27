import type { Metadata } from "next";
import { Suspense } from "react";
import { HeroBrowser } from "./hero-browser";
import { getHeroesWithMeta, type HeroWithMeta } from "@/lib/heroes";

export const metadata: Metadata = { title: "Heroes" };

export default async function HeroesPage() {
  let heroes: HeroWithMeta[] = [];
  let failed = false;
  try {
    heroes = await getHeroesWithMeta();
  } catch (err) {
    console.error("[heroes] failed to load", err);
    failed = true;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pt-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Heroes</h1>
      <p className="mt-2 max-w-[60ch] text-muted">
        Pick a hero to see how it does at each rank in public matches.
      </p>

      {failed ? (
        <div role="alert" className="mt-8 rounded-xl border border-border bg-surface p-6">
          <p className="font-medium">Hero data couldn&apos;t be loaded.</p>
          <p className="mt-1 text-sm text-muted">
            OpenDota might be busy or rate limiting us. Refresh the page in a minute.
          </p>
        </div>
      ) : (
        <Suspense>
          <HeroBrowser heroes={heroes} />
        </Suspense>
      )}
    </div>
  );
}
