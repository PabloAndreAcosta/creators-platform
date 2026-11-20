"use client";

import { useEffect } from "react";

export function HandOff({ href, label }: { href: string; label: string }) {
  useEffect(() => {
    window.location.href = href;
  }, [href]);
  return (
    <a
      href={href}
      className="mt-6 inline-block rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-3 text-sm font-semibold text-black"
    >
      {label}
    </a>
  );
}
