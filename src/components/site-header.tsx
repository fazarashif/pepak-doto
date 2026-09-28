import Link from "next/link";
import { LogoSymbol } from "@/components/brand";
import { HeaderNav, type NavLink } from "@/components/header-nav";
import { SteamSignIn } from "@/components/steam-sign-in";
import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentUser, isAdmin } from "@/lib/auth/session";

const LINKS: NavLink[] = [
  { href: "/draft", label: "Draft" },
  { href: "/match", label: "Match review" },
  { href: "/heroes", label: "Heroes" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  const links = isAdmin(user) ? [...LINKS, { href: "/admin", label: "Admin" }] : LINKS;

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 rounded-md">
          <LogoSymbol className="size-8" />
          <span className="font-display-sc text-lg font-bold tracking-wide">Pepak Doto</span>
        </Link>

        <HeaderNav
          links={links}
          account={user ? { name: user.personaName, avatarUrl: user.avatarUrl } : null}
        />

        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {user ? (
            <Link
              href="/profile"
              className="flex h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-surface-2"
            >
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={28}
                  height={28}
                  className="size-7 rounded-md"
                />
              ) : null}
              <span className="max-w-[12rem] truncate">{user.personaName}</span>
            </Link>
          ) : (
            <SteamSignIn size="sm" />
          )}
        </div>
      </div>
    </header>
  );
}
