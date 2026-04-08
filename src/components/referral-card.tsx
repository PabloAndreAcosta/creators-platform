"use client";

import { useState, useEffect } from "react";
import { Copy, Check, Share2, Users } from "lucide-react";

export function ReferralCard() {
  const [data, setData] = useState<{
    referralCode: string | null;
    referralCount: number;
    referralLink: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Init referral code if needed, then fetch
    fetch("/api/referral", { method: "POST" })
      .then(() => fetch("/api/referral"))
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data?.referralCode) return null;

  async function handleCopy() {
    if (!data?.referralLink) return;
    await navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    if (!data?.referralLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Gå med i Usha",
          text: "Använd min inbjudningslänk och få 50 kr rabatt på ditt första köp!",
          url: data.referralLink,
        });
      } catch {}
    } else {
      handleCopy();
    }
  }

  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Users size={16} className="text-[var(--usha-gold)]" />
        Bjud in vänner
      </div>
      <p className="mt-1 text-xs text-[var(--usha-muted)]">
        Dela din länk — de får 50 kr rabatt på första köpet
      </p>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 font-mono text-xs">
          {data.referralCode}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded-lg border border-[var(--usha-border)] px-3 py-2 text-xs transition hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
        >
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {copied ? "Kopierad" : "Kopiera"}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2 text-xs font-bold text-black"
        >
          <Share2 size={12} /> Dela
        </button>
      </div>

      {data.referralCount > 0 && (
        <p className="mt-2 text-xs text-[var(--usha-muted)]">
          {data.referralCount} person{data.referralCount > 1 ? "er" : ""} har gått med via din länk
        </p>
      )}
    </div>
  );
}
