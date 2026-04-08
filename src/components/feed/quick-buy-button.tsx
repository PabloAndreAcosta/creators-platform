"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag, Ticket, Calendar, Mail, X } from "lucide-react";

interface QuickBuyButtonProps {
  listingId: string;
  listingType: string;
  price: number | null;
  isLoggedIn: boolean;
}

export function QuickBuyButton({
  listingId,
  listingType,
  price,
  isLoggedIn,
}: QuickBuyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const needsDetails = listingType === "service" || listingType === "booking";
  const canGuestCheckout = listingType === "event" || !listingType;

  function getLabel() {
    if (price === null || price === 0) return "Gratis";
    if (listingType === "event") return "Köp biljett";
    if (listingType === "digital_product") return "Köp";
    return "Boka";
  }

  function getIcon() {
    if (listingType === "event") return <Ticket size={12} />;
    if (listingType === "digital_product") return <ShoppingBag size={12} />;
    return <Calendar size={12} />;
  }

  async function doCheckout(guestEmail?: string) {
    setLoading(true);
    try {
      let endpoint: string;
      let body: Record<string, string>;

      if (guestEmail) {
        endpoint = "/api/stripe/guest-checkout";
        body = { listingId, email: guestEmail };
      } else if (listingType === "digital_product") {
        endpoint = "/api/stripe/product-checkout";
        body = { productId: listingId };
      } else {
        endpoint = "/api/stripe/ticket-checkout";
        body = { listingId };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        alert(data.error);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (needsDetails) {
      router.push(`/listing/${listingId}`);
      return;
    }

    if (isLoggedIn) {
      doCheckout();
      return;
    }

    // Guest: for digital products, need account
    if (!canGuestCheckout) {
      router.push(`/login?redirect=/flode`);
      return;
    }

    // Show inline email input
    setShowEmailInput(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return;
    doCheckout(trimmed);
  }

  if (showEmailInput) {
    return (
      <form
        onSubmit={handleEmailSubmit}
        onClick={(e) => e.stopPropagation()}
        className="flex shrink-0 items-center gap-1"
      >
        <div className="relative">
          <Mail size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--usha-muted)]" />
          <input
            ref={inputRef}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="din@email.se"
            required
            className="w-36 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] py-1.5 pl-7 pr-2 text-[11px] outline-none focus:border-[var(--usha-gold)]/50 md:w-44"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !email.includes("@")}
          className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-2.5 py-1.5 text-[11px] font-bold text-black transition hover:opacity-90 disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : getIcon()}
          {loading ? "..." : "Köp"}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowEmailInput(false); setEmail(""); }}
          className="rounded p-0.5 text-[var(--usha-muted)] hover:text-white"
        >
          <X size={14} />
        </button>
      </form>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1.5 text-[11px] font-bold text-black transition hover:opacity-90 disabled:opacity-60 md:px-4 md:text-xs"
    >
      {loading ? (
        <Loader2 size={12} className="animate-spin" />
      ) : (
        getIcon()
      )}
      {loading ? "Vänta..." : getLabel()}
    </button>
  );
}
