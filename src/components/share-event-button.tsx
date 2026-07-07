"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

/**
 * "Invite friends / share you're going" button shown after a booking. Uses the
 * Web Share API when available (native share sheet), falling back to copying the
 * event link. Shares the EVENT url so friends can book the same event.
 */
export function ShareEventButton({
  url,
  title,
  text,
  label,
  className,
}: {
  url: string;
  title: string;
  text?: string;
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    // navigator.share can reject (user cancels) — treat as a no-op.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={
        className ??
        "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--usha-gold)]/40"
      }
    >
      {copied ? <Check size={15} /> : <Share2 size={15} />}
      {copied ? "Länk kopierad" : label}
    </button>
  );
}
