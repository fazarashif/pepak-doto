"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Ubah sebagian parameter URL Game Plan. Parameter lain (mis. item yang sudah dimiliki)
 * tetap dipertahankan, supaya beberapa komponen bisa mengubah URL tanpa saling menimpa.
 */
export function useLiveParams() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const update = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") params.delete(key);
        else params.set(key, value);
      }
      startTransition(() => {
        router.replace(`${pathname}?${params}`, { scroll: false });
      });
    },
    [router, pathname],
  );

  return { update, pending };
}
