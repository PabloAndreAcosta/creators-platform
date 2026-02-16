"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toaster";

export function CheckoutButton({
  planKey,
  label,
  popular,
}: {
  planKey: string;
  label: string;
  popular?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleCheckout() {
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Fel",
          description: data.error || "Kunde inte starta checkout.",
          variant: "error",
        });
        setLoading(false);
      }
    } catch {
      toast({
        title: "Fel",
        description: "Något gick fel. Försök igen.",
        variant: "error",
      });
      setLoading(false);
    }
  }

  return (
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
        toast({
          title: "Fel",
          description: data.error || "Kunde inte öppna portalen.",
          variant: "error",
        });
        setLoading(false);
      }
    } catch {
      toast({
        title: "Fel",
        description: "Något gick fel. Försök igen.",
        variant: "error",
      });
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
