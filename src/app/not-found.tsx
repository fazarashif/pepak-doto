import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto grid max-w-md justify-items-start gap-4 px-4 pt-20 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Page not found</h1>
      <p className="text-muted">The link might be old, or the page was moved.</p>
      <Link href="/" className={buttonStyles({ variant: "secondary" })}>
        Back to the home page
      </Link>
    </div>
  );
}
