"use client";

import { useState } from "react";

export function BroadcastForm({
  listingId,
  recipientCount,
}: {
  listingId: string;
  recipientCount: number;
}) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [busy, setBusy] = useState<"" | "test" | "live">("");
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function send(mode: "test" | "live") {
    if (mode === "live") {
      const ok = window.confirm(
        `Skicka detta utskick till ${recipientCount} mottagare på väntelistan? Det går inte att ångra.`
      );
      if (!ok) return;
    }
    setBusy(mode);
    setMsg(null);
    try {
      const res = await fetch(`/api/events/${listingId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, ctaLabel, ctaUrl, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg({ kind: "err", text: data?.error ?? "Något gick fel." });
      } else if (mode === "test") {
        setMsg({ kind: "ok", text: "Testutskick skickat till din e-post. Kontrollera innan du skickar skarpt." });
      } else {
        setMsg({ kind: "ok", text: `Utskick skickat till ${data.sent} mottagare${data.failed ? ` (${data.failed} misslyckades)` : ""}.` });
      }
    } catch {
      setMsg({ kind: "err", text: "Något gick fel. Försök igen." });
    } finally {
      setBusy("");
    }
  }

  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Compose */}
      <div className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">Rubrik</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="T.ex. Förköpet öppnar nu – 72 timmar"
            className="mt-1 w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">Meddelande</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={8}
            maxLength={10000}
            placeholder="Skriv ditt meddelande…"
            className="mt-1 w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">Knapp-text (valfri)</label>
            <input
              value={ctaLabel}
              onChange={(e) => setCtaLabel(e.target.value)}
              placeholder="Köp biljett"
              className="mt-1 w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-[var(--usha-muted)]">Knapp-länk (valfri)</label>
            <input
              value={ctaUrl}
              onChange={(e) => setCtaUrl(e.target.value)}
              placeholder="https://usha.se/event/…"
              className="mt-1 w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-sm"
            />
          </div>
        </div>

        {msg && (
          <p className={`text-sm ${msg.kind === "ok" ? "text-[var(--usha-gold)]" : "text-red-400"}`}>{msg.text}</p>
        )}

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            onClick={() => send("test")}
            disabled={!canSend || !!busy}
            className="rounded-lg border border-[var(--usha-border)] px-4 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {busy === "test" ? "Skickar…" : "Skicka testutskick till mig"}
          </button>
          <button
            onClick={() => send("live")}
            disabled={!canSend || !!busy || recipientCount === 0}
            className="rounded-lg bg-[var(--usha-gold)] px-4 py-2.5 text-sm font-bold text-black disabled:opacity-50"
          >
            {busy === "live" ? "Skickar…" : `Skicka till ${recipientCount} mottagare`}
          </button>
        </div>
        <p className="text-[11px] text-[var(--usha-muted)]">
          Skicka alltid ett testutskick till dig själv först. Varje mejl innehåller en avregistreringslänk.
        </p>
      </div>

      {/* Preview */}
      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-[var(--usha-muted)]">Förhandsvisning</p>
        <div className="rounded-2xl border border-[var(--usha-border)] bg-white p-5 text-[#111]">
          <p className="text-sm font-bold">{subject || "(rubrik)"}</p>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">
            {body || "(meddelande)"}
          </div>
          {ctaLabel && ctaUrl && (
            <p className="mt-5">
              <span className="inline-block rounded-lg bg-[#c8a445] px-6 py-2.5 text-sm font-bold text-black">
                {ctaLabel}
              </span>
            </p>
          )}
          <hr className="my-4 border-[#eee]" />
          <p className="text-[11px] text-[#999]">
            Du får detta mejl för att du anmälde dig till väntelistan. Avregistrera dig.
          </p>
        </div>
      </div>
    </div>
  );
}
