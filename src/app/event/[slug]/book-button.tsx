"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface Props {
  listingId: string;
  price: number;
  isLoggedIn: boolean;
  returnPath: string;
}

export function BookButton({ listingId, price, isLoggedIn, returnPath }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const isFree = !price || price <= 0;
  const label = isFree ? "Få gratis biljett" : `Köp biljett · ${price} kr`;

  if (!isLoggedIn) {
    const next = encodeURIComponent(returnPath);
    return (
      <a
        href={`/signup?next=${next}`}
        className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black shadow-lg transition hover:opacity-90 sm:text-lg"
      >
        <Ticket size={20} />
        {label}
      </a>
    );
  }

  async function handleClick() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/ticket-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Kunde inte boka", data.error ?? "Försök igen.");
        return;
      }
      if (data.url) {
        if (data.url.startsWith("http")) {
          window.location.href = data.url;
        } else {
          router.push(data.url);
        }
      }
    } catch {
      toast.error("Kunde inte boka", "Försök igen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black shadow-lg transition hover:opacity-90 disabled:opacity-60 sm:text-lg"
    >
      {loading ? <Loader2 size={20} className="animate-spin" /> : <Ticket size={20} />}
      {loading ? "Bokar..." : label}
    </button>
  );
}
