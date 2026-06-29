"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ticket, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface Props {
  listingId: string;
  price: number;
  isLoggedIn: boolean;
  returnPath: string;
}

const BTN =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black shadow-lg transition hover:opacity-90 disabled:opacity-60 whitespace-nowrap sm:text-lg";

export function BookButton({ listingId, price, isLoggedIn }: Props) {
  const { toast } = useToast();
  const t = useTranslations("eventPage");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const isFree = !price || price <= 0;
  const label = isFree ? t("freeTicket") : t("buyTicket", { price });

  async function checkout(endpoint: string, payload: Record<string, unknown>) {
    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(t("errorTitle"), data.error ?? t("errorRetry"));
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch {
      toast.error(t("errorTitle"), t("errorRetry"));
    } finally {
      setLoading(false);
    }
  }

  // Logged-in: existing ticket checkout (uses the account).
  if (isLoggedIn) {
    return (
      <button onClick={() => checkout("/api/stripe/ticket-checkout", { listingId })} disabled={loading} className={BTN}>
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Ticket size={20} />}
        {loading ? t("booking") : label}
      </button>
    );
  }

  // Logged-out: guest checkout — buy with just an email, no account required.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        checkout("/api/stripe/guest-checkout", { listingId, email, name });
      }}
      className="space-y-2"
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("emailPlaceholder")}
        autoComplete="email"
        className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm"
      />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("namePlaceholder")}
        autoComplete="name"
        className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm"
      />
      <button type="submit" disabled={loading} className={BTN}>
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Ticket size={20} />}
        {loading ? t("booking") : label}
      </button>
    </form>
  );
}
