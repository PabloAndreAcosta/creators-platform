"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag, Ticket, Calendar } from "lucide-react";

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
  const router = useRouter();

  // Services and bookings need scheduling info — link to listing page
  const needsDetails = listingType === "service" || listingType === "booking";

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

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) {
      router.push("/login?redirect=/flode");
      return;
    }

    if (needsDetails) {
      router.push(`/listing/${listingId}`);
      return;
    }

    setLoading(true);
    try {
      const endpoint =
        listingType === "digital_product"
          ? "/api/stripe/product-checkout"
          : "/api/stripe/ticket-checkout";

      const body =
        listingType === "digital_product"
          ? { productId: listingId }
          : { listingId };

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
