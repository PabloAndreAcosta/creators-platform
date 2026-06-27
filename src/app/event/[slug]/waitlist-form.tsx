"use client";

import { useState } from "react";

export function WaitlistForm({ listingId }: { listingId: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/events/${listingId}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, consent, source: "event_page" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data?.error ?? "Något gick fel. Försök igen.");
        return;
      }
      setStatus("done");
    } catch {
      setStatus("error");
      setMessage("Något gick fel. Försök igen.");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-center">
        <p className="text-lg font-bold text-[var(--usha-gold)]">Du är med på listan! 🎉</p>
        <p className="mt-2 text-sm text-[var(--usha-muted)]">
          Vi hör av oss till {email} när biljetterna släpps.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6"
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">Väntelista</p>
        <p className="mt-1 text-lg font-bold">Säkra din plats i kön</p>
        <p className="mt-1 text-xs text-[var(--usha-muted)]">
          Anmäl dig gratis så får du veta först när biljetterna släpps.
        </p>
      </div>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Namn (valfritt)"
        autoComplete="name"
        className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm"
      />
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Din e-post"
        autoComplete="email"
        className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm"
      />

      <label className="flex cursor-pointer items-start gap-2 text-[11px] text-[var(--usha-muted)]">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 accent-[var(--usha-gold)]"
        />
        <span>
          Jag godkänner att min e-post sparas för att få information om det här eventet.
          Du kan avregistrera dig när som helst.
        </span>
      </label>

      {status === "error" && <p className="text-xs text-red-400">{message}</p>}

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-[var(--usha-gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-60"
      >
        {status === "loading" ? "Anmäler…" : "Gå med i väntelistan"}
      </button>
    </form>
  );
}
