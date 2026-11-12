"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Biljettsidan medan en Swish-betalning väntar på bekräftelse. Sidan hämtas
 * om med jämna mellanrum, så att QR-koden dyker upp av sig själv när entrén
 * tryckt Bekräfta — gästen ska inte behöva veta att man kan ladda om.
 */
export function PendingRefresh({ everyMs = 15_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const id = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);
  return null;
}
