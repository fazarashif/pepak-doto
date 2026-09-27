import Link from "next/link";
import { CheckCircle, SteamLogo, XCircle } from "@phosphor-icons/react/ssr";
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
    getMostPickedHeroes(19).catch(() => [] as HeroInfo[]),
    searchParams,
  ]);
  const mosaic = heroes.slice(0, 9);
  const radiant = heroes.slice(9, 14);
  const dire = heroes.slice(14, 19);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">
      {params.deleted ? (
        <p
          role="status"
          className="mt-6 rounded-xl border border-border bg-surface px-4 py-3 text-sm"
        >
          Your account and everything saved with it have been deleted.
        </p>
      ) : null}

      <section className="grid items-center gap-12 pt-12 pb-16 md:pt-20 lg:grid-cols-[1.25fr_1fr] lg:gap-14">
        <div className="rise-in grid max-w-2xl gap-6">
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-tight text-balance md:text-5xl xl:text-[3.5rem]">
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

        {mosaic.length === 9 ? (
          <figure className="grid gap-3">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[0, 1, 2].map((col) => (
                <div
                  key={col}
                  className={
                    col === 1 ? "grid gap-2 sm:gap-3 lg:translate-y-6" : "grid gap-2 sm:gap-3"
                  }
                >
                  {mosaic.slice(col * 3, col * 3 + 3).map((hero, i) => (
                    <div
                      key={hero.id}
                      className="rise-in"
                      style={{ "--i": col * 3 + i } as React.CSSProperties}
                    >
                      <HeroPortrait hero={hero} priority />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <figcaption className="text-sm text-muted lg:mt-6">
              The most picked heroes in recent public matches, from OpenDota.
            </figcaption>
          </figure>
        ) : null}
      </section>

      <section aria-labelledby="moments" className="py-16">
        <h2 id="moments" className="max-w-[24ch] text-3xl font-semibold tracking-tight md:text-4xl">
          Help at the three points where games are won or lost
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3 md:grid-rows-[auto_auto]">
          <article className="grid content-between gap-8 rounded-xl border border-border bg-surface p-6 md:col-span-2 md:row-span-2 md:p-8">
            <div className="grid gap-3">
              <StatusLabel />
              <h3 className="text-2xl font-semibold tracking-tight">While you draft</h3>
              <p className="max-w-[52ch] leading-relaxed text-muted">
                Enter the heroes picked so far. You get a short list of heroes that counter the
                enemy lineup and fit your team, with the reason for each one.
              </p>
            </div>
            {dire.length === 5 ? (
              <div className="grid gap-2" aria-hidden>
                <div className="grid grid-cols-5 gap-2">
                  {radiant.map((hero) => (
                    <HeroPortrait key={hero.id} hero={hero} decorative />
                  ))}
                </div>
                <p className="text-center text-xs tracking-wide text-muted">vs</p>
                <div className="grid grid-cols-5 gap-2">
                  {dire.map((hero) => (
                    <HeroPortrait key={hero.id} hero={hero} decorative />
                  ))}
                </div>
              </div>
            ) : null}
          </article>

          <article className="grid gap-4 rounded-xl border border-border bg-surface-2 p-6">
            <StatusLabel />
            <h3 className="text-xl font-semibold tracking-tight">During the game</h3>
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
                    className="h-10 w-auto rounded-lg"
                  />
                </li>
              ))}
            </ul>
          </article>

          <article className="grid gap-4 rounded-xl border border-accent/30 bg-gradient-to-br from-accent/15 via-surface to-surface p-6">
            <StatusLabel />
            <h3 className="text-xl font-semibold tracking-tight">After the game</h3>
            <p className="leading-relaxed text-muted">
              Paste a match ID to see how your laning, farm, deaths and item timings compare with
              other players on the same hero, and what to work on next.
            </p>
          </article>
        </div>
      </section>

      <section
        aria-labelledby="steam-data"
        className="grid gap-10 border-t border-border py-16 lg:grid-cols-[1fr_1.2fr]"
      >
        <div className="grid content-start gap-4">
          <h2 id="steam-data" className="text-3xl font-semibold tracking-tight">
            What we get from your Steam account
          </h2>
          <p className="max-w-[52ch] leading-relaxed text-muted">
            Signing in only proves which Steam account is yours. Your match history comes from
            public data, so turn on <span className="text-fg">Expose Public Match Data</span> in the
            Dota 2 settings if you haven&apos;t already.
          </p>
          <Link
            href="/privacy"
            className="text-sm text-accent-fg underline-offset-4 hover:underline"
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
    <span className="w-fit rounded-lg border border-border px-2 py-0.5 text-xs text-muted">
      In development
    </span>
  );
}

function DataList({ title, icon, items }: { title: string; icon: "yes" | "no"; items: string[] }) {
  const Icon = icon === "yes" ? CheckCircle : XCircle;
  return (
    <div className="grid content-start gap-3">
      <h3 className="font-medium">{title}</h3>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-muted">
            <Icon
              size={20}
              weight="fill"
              aria-hidden
              className={icon === "yes" ? "text-radiant" : "text-muted"}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
