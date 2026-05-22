"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toaster";
import { CreditCard, Loader2 } from "lucide-react";

export function PayB2BButton({ bookingId, price }: { bookingId: string; price: number | null }) {
  const { toast } = useToast();
  const t = useTranslations("bookingsPage");
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/booking-pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(t("payB2BError"), data.error || t("payB2BErrorUnknown"));
        setLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      toast.error(t("payB2BError"), t("payB2BErrorRetry"));
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2 text-xs font-bold text-black transition hover:opacity-90 disabled:opacity-50"
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <CreditCard size={12} />}
      {loading ? t("payB2BLoading") : price != null ? t("payB2BWithPrice", { price }) : t("payB2BButton")}
    </button>
  );
}
