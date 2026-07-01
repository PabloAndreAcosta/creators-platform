"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

export function AccessCodeForm({ listingId, isLoggedIn }: { listingId: string; isLoggedIn: boolean }) {
  const t = useTranslations("eventPage");
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/events/${listingId}/redeem-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error ?? t("errorGeneric"));
        return;
      }
      // Discount code → server returns a Stripe Checkout URL. Free code → { ok }.
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage(t("errorGeneric"));
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 text-center">
        <p className="text-base font-bold text-[var(--usha-gold)]">{t("codeSuccessTitle")}</p>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          {t("codeSuccessBody", { email: isLoggedIn ? email || "din e-post" : email })}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-dashed border-[var(--usha-border)] px-4 py-2.5 text-center text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
      >
        {t("haveCode")}
      </button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <input
        type="text"
        required
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder={t("codePlaceholder")}
        className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm uppercase"
      />
      {!isLoggedIn && (
        <>
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
        </>
      )}
      {status === "error" && <p className="text-xs text-red-400">{message}</p>}
      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-[var(--usha-gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
      >
        {status === "loading" ? t("redeeming") : t("redeemButton")}
      </button>
    </form>
  );
}
