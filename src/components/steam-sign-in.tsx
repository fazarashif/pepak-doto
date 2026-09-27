import { SteamLogo } from "@phosphor-icons/react/ssr";
import { buttonStyles, type ButtonStyleProps } from "@/components/ui/button";

/**
 * Tombol masuk dengan Steam. Sengaja memakai <a> biasa, bukan next/link:
 * route ini me-redirect ke steamcommunity.com, dan navigasi client-side Next
 * akan mencoba fetch redirect lintas domain itu lalu gagal ("Failed to fetch").
 */
export function SteamSignIn({
  next,
  size = "md",
  className,
}: {
  next?: string;
  size?: ButtonStyleProps["size"];
  className?: string;
}) {
  const href = next ? `/api/auth/steam?next=${encodeURIComponent(next)}` : "/api/auth/steam";
  return (
    <a href={href} className={buttonStyles({ size, className })}>
      <SteamLogo size={size === "lg" ? 20 : 18} weight="fill" aria-hidden />
      Sign in with Steam
    </a>
  );
}
