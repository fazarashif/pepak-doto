import Link from "next/link";
import { ChapterLabel, MaskedSvg } from "@/components/brand";
import { buttonStyles } from "@/components/ui/button";

/** Halaman fitur yang belum jadi. Menjelaskan alasannya alih-alih menyembunyikan menu. */
export function ComingSoon({
  chapter,
  illustration,
  title,
  description,
}: {
  chapter: string;
  illustration: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto grid max-w-2xl justify-items-start gap-5 px-4 pt-16 sm:px-6">
      <MaskedSvg src={illustration} className="h-32 w-48 text-accent" />
      <div className="flex flex-wrap items-center gap-3">
        <ChapterLabel>{chapter}</ChapterLabel>
        <span className="rounded-sm border border-border px-2 py-0.5 text-xs text-muted">
          In development
        </span>
      </div>
      <h1 className="font-display text-3xl font-bold">{title}</h1>
      <p className="max-w-[56ch] leading-relaxed text-muted">{description}</p>
      <Link href="/heroes" className={buttonStyles({ variant: "secondary" })}>
        Browse heroes in the meantime
      </Link>
    </div>
  );
}
