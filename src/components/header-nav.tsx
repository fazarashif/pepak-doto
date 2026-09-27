"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { List, SteamLogo, X } from "@phosphor-icons/react";
import { ThemeToggle } from "@/components/theme-toggle";
import { buttonStyles } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export interface NavLink {
  href: string;
  label: string;
}

interface Props {
  links: NavLink[];
  account: { name: string; avatarUrl: string | null } | null;
}

export function HeaderNav({ links, account }: Props) {
  const pathname = usePathname();
  // Menu HP dianggap terbuka hanya untuk halaman tempat ia dibuka,
  // jadi otomatis tertutup setiap pindah halaman.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const panelId = useId();

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <nav aria-label="Main" className="hidden md:block">
        <ul className="flex items-center gap-1">
          {links.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive(link.href) ? "page" : undefined}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg",
                  isActive(link.href) && "text-fg",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="ml-auto flex items-center gap-1 md:hidden">
        <ThemeToggle />
        <button
          type="button"
          className={buttonStyles({ variant: "ghost", size: "icon" })}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpenOn(open ? null : pathname)}
        >
          {open ? <X size={22} aria-hidden /> : <List size={22} aria-hidden />}
        </button>
      </div>

      <div
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-16 border-b border-border bg-bg md:hidden"
      >
        <nav aria-label="Main" className="mx-auto max-w-6xl px-4 py-3">
          <ul className="grid gap-1">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center rounded-lg px-3 text-base text-muted hover:bg-surface-2 hover:text-fg",
                    isActive(link.href) && "bg-surface-2 text-fg",
                  )}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 border-t border-border pt-3">
            {account ? (
              <Link
                href="/profile"
                className="flex h-12 items-center gap-3 rounded-lg px-3 hover:bg-surface-2"
              >
                {account.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={account.avatarUrl} alt="" className="size-8 rounded-lg" />
                ) : null}
                <span className="truncate">{account.name}</span>
              </Link>
            ) : (
              <Link
                href="/api/auth/steam"
                prefetch={false}
                className={buttonStyles({ className: "w-full" })}
              >
                <SteamLogo size={18} weight="fill" aria-hidden />
                Sign in with Steam
              </Link>
            )}
          </div>
        </nav>
      </div>
    </>
  );
}
