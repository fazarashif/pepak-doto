import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { CheckCircle, SteamLogo, XCircle } from "@phosphor-icons/react/ssr";
import { ChapterLabel, Divider, FramedPanel, MaskedSvg } from "@/components/brand";
import { HeroPortrait } from "@/components/hero-portrait";
import { buttonStyles } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { assetUrl, type HeroInfo } from "@/lib/dota";
import { getMostPickedHeroes } from "@/lib/heroes";

const ITEMS = [
  { key: "black_king_bar", name: "Black King Bar" },
  { key: "blink", name: "Blink Dagger" },
  { key: "ultimate_scepter", name: "Aghanim's Scepter" },
  { key: "spirit_vessel", name: "Spirit Vessel" },
];

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const [user, heroes, params] = await Promise.all([
    getCurrentUser(),
    getMostPickedHeroes(10).catch((err) => {
      unstable_rethrow(err);
      return [] as HeroInfo[];
    }),
    searchParams,
  ]);
  const radiant = heroes.slice(0, 5);
  const dire = heroes.slice(5, 10);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {params.deleted ? (
        <p
          role="status"
          className="mt-6 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
        >
          Your account and everything saved with it have been deleted.
        </p>
      ) : null}

      <section className="grid items-center gap-8 pt-10 pb-12 md:pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] lg:gap-10">
        <div className="rise-in grid max-w-xl gap-6">
          <h1 className="font-display text-4xl leading-[1.08] font-bold text-balance md:text-5xl xl:text-[3.5rem]">
            Get better at Dota, one match at a time.
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-muted">
            Pepak Doto helps you draft, choose items against the heroes in your game, and review
            what went wrong afterwards.
          </p>
          <div className="flex flex-wrap gap-3">
            {user ? (
              <Link href="/profile" className={buttonStyles({ size: "lg" })}>
                Open your profile
              </Link>
            ) : (
              <Link
                href="/api/auth/steam"
                prefetch={false}
                className={buttonStyles({ size: "lg" })}
              >
                <SteamLogo size={20} weight="fill" aria-hidden />
                Sign in with Steam
              </Link>
            )}
            <Link href="/heroes" className={buttonStyles({ variant: "secondary", size: "lg" })}>
              Browse heroes
            </Link>
          </div>
        </div>

        <div
          role="img"
          aria-label="An open field guide with the three-lane Dota map drawn in batik linework"
          className="hero-banner rise-in -mx-4 sm:mx-0 sm:rounded-lg"
          style={{ "--i": 2 } as React.CSSProperties}
        />
      </section>

      <Divider className="md:mx-auto md:block" />

      <section aria-labelledby="moments" className="py-16">
        <h2 id="moments" className="max-w-[24ch] font-display text-3xl font-bold md:text-4xl">
          Help at the three points where games are won or lost
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <FramedPanel
            as="article"
            tab="Chapter I"
            className="grid items-center gap-8 p-6 md:col-span-2 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
          >
            <div className="grid justify-items-start gap-3">
              <MaskedSvg src="/brand/spot-draft.svg" className="mb-2 h-20 w-32 text-accent" />
              <h3 className="font-display text-2xl font-bold">While you draft</h3>
              <p className="max-w-[48ch] leading-relaxed text-muted">
                Enter the heroes picked so far. You get a short list of heroes that counter the
                enemy lineup and fit your team, with the reason for each one.
              </p>
              <StatusLabel />
            </div>
            {dire.length === 5 ? (
              <div className="grid gap-2" aria-hidden>
                <div className="grid grid-cols-5 gap-2">
                  {radiant.map((hero) => (
                    <HeroPortrait key={hero.id} hero={hero} decorative />
                  ))}
                </div>
                <p className="text-center font-display text-sm text-muted italic">versus</p>
                <div className="grid grid-cols-5 gap-2">
                  {dire.map((hero) => (
                    <HeroPortrait key={hero.id} hero={hero} decorative />
                  ))}
                </div>
              </div>
            ) : null}
          </FramedPanel>

          <article className="grid content-start gap-4 rounded-lg border border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <ChapterLabel>Chapter II</ChapterLabel>
              <MaskedSvg src="/brand/spot-game.svg" className="h-16 w-24 text-accent" />
            </div>
            <h3 className="font-display text-xl font-bold">During the game</h3>
            <p className="leading-relaxed text-muted">
              Item suggestions based on the enemy heroes, plus when your team is strongest.
            </p>
            <ul className="flex gap-2" aria-label="Example items">
              {ITEMS.map((item) => (
                <li key={item.key}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetUrl(`/apps/dota2/images/dota_react/items/${item.key}.png`)}
                    alt={item.name}
                    width={88}
                    height={64}
                    loading="lazy"
                    className="h-10 w-auto rounded-md"
                  />
                </li>
              ))}
            </ul>
            <StatusLabel />
          </article>

          <article className="grid content-start gap-4 rounded-lg border border-border bg-surface p-6">
            <div className="flex items-start justify-between gap-4">
              <ChapterLabel>Chapter III</ChapterLabel>
              <MaskedSvg src="/brand/spot-review.svg" className="h-16 w-24 text-accent" />
            </div>
            <h3 className="font-display text-xl font-bold">After the game</h3>
            <p className="leading-relaxed text-muted">
              Paste a match ID to see how your laning, farm, deaths and item timings compare with
              other players on the same hero, and what to work on next.
            </p>
            <StatusLabel />
          </article>
        </div>
      </section>

      <Divider className="md:mx-auto md:block" />

      <section aria-labelledby="steam-data" className="grid gap-10 py-16 lg:grid-cols-[1fr_1.2fr]">
        <div className="grid content-start gap-4">
          <h2 id="steam-data" className="font-display text-3xl font-bold">
            What we get from your Steam account
          </h2>
          <p className="max-w-[52ch] leading-relaxed text-muted">
            Signing in only proves which Steam account is yours. Your match history comes from
            public data, so turn on <span className="text-fg">Expose Public Match Data</span> in the
            Dota 2 settings if you haven&apos;t already.
          </p>
          <Link
            href="/privacy"
            className="w-fit text-sm text-accent-fg underline-offset-4 hover:underline"
          >
            Read the privacy policy
          </Link>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <DataList
            title="Used by Pepak Doto"
            icon="yes"
            items={[
              "Your Steam ID",
              "Profile name and avatar",
              "Rank medal",
              "Public match history",
            ]}
          />
          <DataList
            title="Never shared with us"
            icon="no"
            items={[
              "Your Steam password",
              "Email or phone number",
              "Friends list",
              "Inventory and payments",
            ]}
          />
        </div>
      </section>
    </div>
  );
}

function StatusLabel() {
  return (
    <span className="w-fit rounded-sm border border-border px-2 py-0.5 text-xs text-muted">
      In development
    </span>
  );
}

function DataList({ title, icon, items }: { title: string; icon: "yes" | "no"; items: string[] }) {
  const Icon = icon === "yes" ? CheckCircle : XCircle;
  return (
    <div className="grid content-start gap-3">
      <h3 className="font-display text-lg font-bold">{title}</h3>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-muted">
            <Icon
              size={20}
              weight="fill"
              aria-hidden
              className={icon === "yes" ? "text-accent-fg" : "text-muted"}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
