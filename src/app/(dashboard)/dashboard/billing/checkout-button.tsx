"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toaster";
import { PromoCodeInput, type DiscountInfo } from "@/components/promo-code-input";

export function CheckoutButton({
  planKey,
  label,
  popular,
  price,
}: {
  planKey: string;
  label: string;
  popular?: boolean;
  price?: number;
}) {
  const [loading, setLoading] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [discountInfo, setDiscountInfo] = useState<DiscountInfo | null>(null);
  const [showPromo, setShowPromo] = useState(false);
  const { toast } = useToast();

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, promoCode: promoCode || undefined }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Kunde inte starta checkout", data.detail || data.error || "Försök igen.");
        setLoading(false);
      }
    } catch {
      toast.error("Något gick fel", "Ingen anslutning. Försök igen.");
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {!showPromo ? (
        <button
          onClick={() => setShowPromo(true)}
          className="text-xs text-[var(--usha-muted)] hover:text-[var(--usha-gold)] transition-colors"
        >
          Har du en promokod?
        </button>
      ) : (
        <PromoCodeInput
          scope="subscription"
          planKey={planKey}
          originalPrice={price}
          onValidCode={(code, info) => {
            setPromoCode(code);
            setDiscountInfo(info);
          }}
        />
      )}
      <button
        onClick={handleCheckout}
        disabled={loading}
        className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition disabled:opacity-50 ${
          popular
            ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black hover:opacity-90"
            : "border border-[var(--usha-border)] text-white hover:border-[var(--usha-gold)]/30"
        }`}
      >
        {loading ? "Laddar..." : label}
      </button>
    </div>
  );
}

export function PortalButton() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handlePortal() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Kunde inte öppna portalen", data.error || "Försök igen.");
        setLoading(false);
      }
    } catch {
      toast.error("Något gick fel", "Ingen anslutning. Försök igen.");
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handlePortal}
      disabled={loading}
      className="rounded-xl border border-[var(--usha-border)] px-6 py-3 text-sm font-medium transition-colors hover:border-[var(--usha-gold)]/30 hover:text-white disabled:opacity-50"
    >
      {loading ? "Laddar..." : "Hantera prenumeration"}
    </button>
  );
}
