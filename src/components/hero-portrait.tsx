import { cn } from "@/lib/cn";
import type { HeroInfo } from "@/lib/dota";

interface Props {
  hero: Pick<HeroInfo, "name" | "img">;
  className?: string;
  /** Kosongkan alt kalau nama hero sudah tertulis di sebelahnya. */
  decorative?: boolean;
  priority?: boolean;
}

/** Potret hero resmi dari CDN Dota (256×144). */
export function HeroPortrait({ hero, className, decorative = false, priority = false }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={hero.img}
      alt={decorative ? "" : hero.name}
      width={256}
      height={144}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      className={cn("aspect-[16/9] w-full rounded-md bg-surface-2 object-cover", className)}
    />
  );
}
