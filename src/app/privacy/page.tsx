import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <article className="mx-auto grid max-w-2xl gap-8 px-4 pt-10 leading-relaxed sm:px-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_p]:text-muted [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1 [&_ul]:pl-5 [&_ul]:text-muted">
      <header className="grid gap-2">
        <h1 className="font-display text-3xl font-bold">Privacy</h1>
        <p className="text-sm">Last updated September 27, 2026</p>
      </header>

      <section className="grid gap-3">
        <h2>What we store</h2>
        <p>
          You can use most of Pepak Doto without signing in. If you do sign in with Steam, we save:
        </p>
        <ul>
          <li>your Steam ID and the Dota account ID that comes from it</li>
          <li>your Steam profile name, avatar and profile link</li>
          <li>your rank medal, as reported by OpenDota</li>
          <li>the preferences you set, such as rank and main position</li>
          <li>when you created the account and when you last signed in</li>
        </ul>
      </section>

      <section className="grid gap-3">
        <h2>What we never see</h2>
        <p>
          Signing in happens on Steam&apos;s own website. Steam tells us which account you used and
          nothing else, so we never get your password, email, phone number, friends list, inventory
          or payment details.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>Where match data comes from</h2>
        <p>
          Match history and statistics come from OpenDota and STRATZ, which only have your matches
          if <span className="text-fg">Expose Public Match Data</span> is turned on in Dota 2.
          Profile names and avatars come from Steam or OpenDota. We cache some of this data for a
          while so we don&apos;t have to ask those services again on every page load.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>Cookies and analytics</h2>
        <p>
          We set one cookie to keep you signed in, and a short-lived one while you&apos;re on the
          Steam sign-in page. Your theme choice is kept in your browser&apos;s local storage.
          Visitor counts come from Vercel Web Analytics, which doesn&apos;t use cookies.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>AI-written notes</h2>
        <p>
          Some features will use a language model to turn match statistics into written advice. When
          that happens, we send only the numbers needed for the note, without your name, Steam ID or
          match ID. Free model providers may use what we send to improve their models.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>Deleting your data</h2>
        <p>
          You can delete your account from your profile page at any time. That removes everything
          listed under &ldquo;What we store&rdquo;. Your Steam account and your match history on
          Steam, OpenDota and STRATZ are not affected.
        </p>
      </section>

      <section className="grid gap-3">
        <h2>Questions</h2>
        <p>
          Open an issue on{" "}
          <a
            href="https://github.com/fazarashif/pepak-doto/issues"
            className="text-accent-fg underline-offset-4 hover:underline"
          >
            GitHub
          </a>
          .
        </p>
      </section>
    </article>
  );
}
