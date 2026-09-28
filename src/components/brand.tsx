import { cn } from "@/lib/cn";

/**
 * SVG satu warna dari /brand, diwarnai dengan warna teks (class `text-*`).
 * Dekoratif secara default; beri `label` kalau gambarnya punya arti.
 */
export function MaskedSvg({
  src,
  className,
  label,
  style,
}: {
  src: string;
  className?: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const mask = `url(${src}) center / contain no-repeat`;
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("inline-block shrink-0 bg-current", className)}
      style={{ WebkitMask: mask, mask, ...style }}
    />
  );
}

/** Simbol logo berwarna, versi gelap/terang dipilih lewat tema. */
export function LogoSymbol({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block shrink-0", className)} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-symbol-light.svg" alt="" className="size-full dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-symbol-dark.svg" alt="" className="hidden size-full dark:block" />
    </span>
  );
}

/** Pembatas antar bab atau section. Jangan dipakai di antara baris list. */
export function Divider({ className }: { className?: string }) {
  return (
    <MaskedSvg
      src="/brand/ornament-divider.svg"
      className={cn("h-4 w-[200px] text-accent md:w-[240px]", className)}
    />
  );
}

/** Label bab dalam huruf kapital kecil, mis. "Chapter I". */
export function ChapterLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn("font-display-sc text-sm font-bold tracking-wide text-accent-fg", className)}
    >
      {children}
    </span>
  );
}

/** Pita bookmark. Hanya untuk satu item per layar: bab aktif, pick teratas, atau hero terpilih. */
export function Ribbon({ className }: { className?: string }) {
  return (
    <MaskedSvg
      src="/brand/ornament-ribbon.svg"
      className={cn(
        "ribbon-in pointer-events-none absolute -top-1 right-4 h-16 w-4 text-accent",
        className,
      )}
    />
  );
}

/**
 * Panel utama di satu layar: sudut ornamen di dua sisi berseberangan, tab indeks, dan pita opsional.
 * Maksimal satu per layar; panel lain cukup border 1px.
 */
export function FramedPanel({
  tab,
  ribbon = false,
  className,
  children,
  as: Tag = "div",
}: {
  tab?: string;
  ribbon?: boolean;
  className?: string;
  children: React.ReactNode;
  as?: "div" | "article" | "section" | "aside";
}) {
  return (
    <Tag
      className={cn(
        "relative rounded-lg border border-border bg-surface",
        tab && "mt-4",
        className,
      )}
    >
      <MaskedSvg
        src="/brand/ornament-corner.svg"
        className="absolute top-1.5 left-1.5 size-6 text-accent/70"
      />
      <MaskedSvg
        src="/brand/ornament-corner.svg"
        className="absolute right-1.5 bottom-1.5 size-6 rotate-180 text-accent/70"
      />
      {tab ? (
        <span className="absolute -top-4 left-12 grid h-8 w-28 place-items-center">
          <MaskedSvg
            src="/brand/ornament-index-tab.svg"
            className="absolute inset-0 size-full text-accent"
          />
          <span className="relative font-display-sc text-sm font-bold text-on-accent">{tab}</span>
        </span>
      ) : null}
      {ribbon ? <Ribbon /> : null}
      {children}
    </Tag>
  );
}

/** Penanda catatan pinggir sebelum tips atau alasan rekomendasi. */
export function MarginNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("flex items-start gap-2 font-display text-accent-fg italic", className)}>
      <MaskedSvg src="/brand/ornament-margin-note.svg" className="mt-1.5 size-3 text-accent" />
      <span>{children}</span>
    </p>
  );
}
