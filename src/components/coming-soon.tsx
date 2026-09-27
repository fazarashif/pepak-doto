import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

/** Halaman fitur yang belum jadi. Menjelaskan alasannya alih-alih menyembunyikan menu. */
export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="mx-auto grid max-w-2xl gap-5 px-4 pt-16 sm:px-6">
      <span className="w-fit rounded-lg border border-border px-2 py-0.5 text-xs text-muted">
        In development
      </span>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="max-w-[56ch] leading-relaxed text-muted">{description}</p>
      <Link href="/heroes" className={buttonStyles({ variant: "secondary", className: "w-fit" })}>
        Browse heroes in the meantime
      </Link>
    </div>
  );
}
