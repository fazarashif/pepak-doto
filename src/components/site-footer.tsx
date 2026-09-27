import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="max-w-[60ch]">
          Dota 2 is a registered trademark of Valve Corporation. Pepak Doto is a fan project and is
          not affiliated with or endorsed by Valve.
        </p>
        <nav aria-label="Footer">
          <ul className="flex gap-4">
            <li>
              <Link href="/privacy" className="hover:text-fg">
                Privacy
              </Link>
            </li>
            <li>
              <a href="https://github.com/fazarashif/pepak-doto" className="hover:text-fg">
                GitHub
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
