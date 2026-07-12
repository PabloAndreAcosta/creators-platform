"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Ticket, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface TicketType {
  id: string;
  name: string;
  price: number;
  capacity: number | null;
  tickets_sold: number;
}

interface Props {
  listingId: string;
  price: number;
  isLoggedIn: boolean;
  returnPath: string;
  ticketTypes?: TicketType[];
}

const BTN =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black shadow-lg transition hover:opacity-90 disabled:opacity-60 whitespace-nowrap sm:text-lg";

function soldOut(tt: TicketType) {
  return tt.capacity != null && tt.tickets_sold >= tt.capacity;
}

export function BookButton({ listingId, price, isLoggedIn, ticketTypes = [] }: Props) {
  const { toast } = useToast();
  const t = useTranslations("eventPage");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const hasTypes = ticketTypes.length > 0;
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    () => ticketTypes.find((tt) => !soldOut(tt))?.id ?? ticketTypes[0]?.id ?? ""
  );
  const selectedType = hasTypes ? ticketTypes.find((tt) => tt.id === selectedTypeId) ?? null : null;
  const effectivePrice = selectedType ? selectedType.price : price;
  const typeSoldOut = selectedType ? soldOut(selectedType) : false;

  const isFree = !effectivePrice || effectivePrice <= 0;
  const label = isFree ? t("freeTicket") : t("buyTicket", { price: effectivePrice });

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

  const picker = hasTypes ? (
    <div className="mb-3 space-y-2">
      {ticketTypes.map((tt) => {
        const out = soldOut(tt);
        const active = tt.id === selectedTypeId;
        return (
          <button
            type="button"
            key={tt.id}
            disabled={out}
            onClick={() => setSelectedTypeId(tt.id)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition disabled:opacity-40 ${
              active
                ? "border-[var(--usha-gold)]/60 bg-[var(--usha-gold)]/10 text-[var(--usha-white)]"
                : "border-[var(--usha-border)] text-[var(--usha-white)] hover:border-[var(--usha-gold)]/40"
            }`}
          >
            <span className="font-medium">{tt.name}</span>
            <span className="text-[var(--usha-muted)]">
              {out ? t("soldOut") : tt.price > 0 ? t("priceLabel", { price: tt.price }) : t("freeTicket")}
            </span>
          </button>
        );
      })}
    </div>
  ) : null;

  // Logged-in: existing ticket checkout (uses the account).
  if (isLoggedIn) {
    return (
      <>
        {picker}
        <button
          onClick={() => checkout("/api/stripe/ticket-checkout", { listingId, ticketTypeId: selectedTypeId || undefined })}
          disabled={loading || typeSoldOut}
          className={BTN}
        >
          {loading ? <Loader2 size={20} className="animate-spin" /> : <Ticket size={20} />}
          {loading ? t("booking") : label}
        </button>
      </>
    );
  }

  // Logged-out: guest checkout — buy with just an email, no account required.
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        checkout("/api/stripe/guest-checkout", { listingId, email, name, ticketTypeId: selectedTypeId || undefined });
      }}
      className="space-y-2"
    >
      {picker}
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
      <button type="submit" disabled={loading || typeSoldOut} className={BTN}>
        {loading ? <Loader2 size={20} className="animate-spin" /> : <Ticket size={20} />}
        {loading ? t("booking") : label}
      </button>
    </form>
  );
}
