"use client";

import { useState, useTransition } from "react";
import { Link2, RefreshCw, Trash2, Check, Download } from "lucide-react";
import { generateCalendarSyncToken, revokeCalendarSyncToken } from "./actions";

interface CalendarSyncProps {
  initialFeedUrl: string | null;
  /** När flödet senast hämtades av en kalenderklient, om någonsin. */
  lastFetchedAt: string | null;
  /** Grov gissning av vilken klient som hämtade: google | apple | outlook | other. */
  lastClient: string | null;
}

const CLIENT_LABELS: Record<string, string> = {
  google: "Google Calendar",
  apple: "Apple Kalender",
  outlook: "Outlook",
  other: "en kalender",
};

function describeFetch(iso: string | null, client: string | null): string {
  if (!iso) {
    return "Ingen kalender har hämtat flödet ännu. Har du precis lagt till det kan det dröja innan din kalender hör av sig.";
  }
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  const when =
    minutes < 60
      ? `${minutes} min sedan`
      : minutes < 60 * 48
        ? `${Math.round(minutes / 60)} tim sedan`
        : `${Math.round(minutes / (60 * 24))} dagar sedan`;
  return `Hämtat av ${CLIENT_LABELS[client ?? "other"] ?? CLIENT_LABELS.other} — ${when}.`;
}

export function CalendarSync({ initialFeedUrl, lastFetchedAt, lastClient }: CalendarSyncProps) {
  const [feedUrl, setFeedUrl] = useState(initialFeedUrl);
  const [isPending, startTransition] = useTransition();
  const [added, setAdded] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmingRotate, setConfirmingRotate] = useState(false);

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateCalendarSyncToken();
      if (result.feedUrl) setFeedUrl(result.feedUrl);
    });
  };

  const handleRevoke = () => {
    startTransition(async () => {
      const result = await revokeCalendarSyncToken();
      if (result.success) setFeedUrl(null);
    });
  };

  function getWebcalUrl() {
    if (!feedUrl) return "";
    return feedUrl.replace("https://", "webcal://").replace("http://", "webcal://");
  }

  function getGoogleUrl() {
    if (!feedUrl) return "";
    // Google Calendar requires webcal:// protocol in the cid parameter
    const webcalFeed = feedUrl.replace("https://", "webcal://").replace("http://", "webcal://");
    return `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalFeed)}`;
  }

  function getOutlookUrl() {
    if (!feedUrl) return "";
    return `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=Usha Platform%20Bokningar`;
  }

  function handleCalendarClick(type: string) {
    // Vi vet inte om kalendern faktiskt lades till — knappen öppnar bara
    // leverantörens sida. Kvittensen får därför beskriva vad vi gjorde, inte
    // påstå ett resultat vi inte kan se.
    setAdded(type);
    setTimeout(() => setAdded(null), 8000);
  }

  async function handleCopy() {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  }

  // Att skapa en ny token gör den gamla adressen ogiltig, vilket tyst bryter
  // varje kalender som redan prenumererar. Knappen hette "Ny URL" och gjorde
  // det utan förvarning — nu krävs två klick och texten säger vad som händer.
  function handleRotate() {
    if (!confirmingRotate) {
      setConfirmingRotate(true);
      setTimeout(() => setConfirmingRotate(false), 5000);
      return;
    }
    setConfirmingRotate(false);
    handleGenerate();
  }

  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 space-y-4">
      <h2 className="text-sm font-semibold flex items-center gap-2">
        <Link2 size={16} className="text-[var(--usha-gold)]" />
        Synka med din kalender
      </h2>

      {!feedUrl ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--usha-muted)]">
            Synka dina Usha Platform-bokningar med Google Calendar, Apple Calendar eller Outlook.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Link2 size={14} />
            {isPending ? "Aktiverar..." : "Aktivera kalendersynk"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Adressen till flödet. Den här vägen är den enda som fungerar
              överallt: knapparna nedan förlitar sig på att operativsystemet
              hanterar webcal:// eller att leverantörens webbflöde stödjer
              mobilen, och på Android gör varken det ena eller det andra det. */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-medium text-[var(--usha-muted)]">
              Adress till kalenderflödet
            </label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={feedUrl ?? ""}
                onFocus={(e) => e.currentTarget.select()}
                className="min-w-0 flex-1 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-2 py-1.5 font-mono text-[10px] text-[var(--usha-muted)] outline-none"
              />
              <button
                onClick={handleCopy}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                  copied
                    ? "bg-green-500/20 text-green-400"
                    : "bg-[var(--usha-card-hover)] text-[var(--usha-white)] hover:opacity-80"
                }`}
              >
                {copied ? "Kopierad" : "Kopiera"}
              </button>
            </div>
            <p
              className={`flex items-center gap-1.5 text-[11px] ${
                lastFetchedAt ? "text-green-400" : "text-[var(--usha-muted)]"
              }`}
            >
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${lastFetchedAt ? "bg-green-400" : "bg-[var(--usha-muted)]"}`} />
              {describeFetch(lastFetchedAt, lastClient)}
            </p>
            <p className="text-[10px] leading-relaxed text-[var(--usha-muted)]">
              Klistra in adressen i din kalender för att prenumerera. I Google
              Calendar går det bara från en dator: <span className="text-[var(--usha-white)]">Andra
              kalendrar → Från webbadress</span>. Bokningarna dyker upp när
              kalendern hämtat flödet, vilket kan ta upp till ett dygn.
            </p>
          </div>

          {/* One-click calendar buttons */}
          <div className="grid gap-2 sm:grid-cols-3">
            <a
              href={getGoogleUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleCalendarClick("google")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/30 hover:bg-[var(--usha-card-hover)]"
            >
              {added === "google" ? <Check size={16} className="text-green-400" /> : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 5.523 4.477 10 10 10s10-4.477 10-10z" fill="#fff" fillOpacity=".1"/><path d="M17.5 12h-4v4.5h-3V12h-4V9h4V4.5h3V9h4v3z" fill="#4285F4"/></svg>
              )}
              Google
            </a>

            <a
              href={getWebcalUrl()}
              onClick={() => handleCalendarClick("apple")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/30 hover:bg-[var(--usha-card-hover)]"
            >
              {added === "apple" ? <Check size={16} className="text-green-400" /> : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83z"/><path d="M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              )}
              Apple
            </a>

            <a
              href={getOutlookUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleCalendarClick("outlook")}
              className="flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/30 hover:bg-[var(--usha-card-hover)]"
            >
              {added === "outlook" ? <Check size={16} className="text-green-400" /> : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" fill="#0078D4" fillOpacity=".2" stroke="#0078D4" strokeWidth="1.5"/><path d="M2 8l10 5 10-5" stroke="#0078D4" strokeWidth="1.5"/></svg>
              )}
              Outlook
            </a>
          </div>

          {added && (
            <p className="text-center text-xs text-[var(--usha-muted)]">
              Öppnade {added === "google" ? "Google Calendar" : added === "apple" ? "Apple Kalender" : "Outlook"}.
              Fungerade det inte — vilket är vanligt på mobil — använd adressen ovan i stället.
            </p>
          )}

          {/* Secondary actions */}
          <div className="flex items-center justify-between border-t border-[var(--usha-border)] pt-3">
            <div className="flex gap-2">
              <a
                href="/api/calendar/export"
                download
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
              >
                <Download size={10} />
                .ics
              </a>
              <button
                onClick={handleRotate}
                disabled={isPending}
                className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] disabled:opacity-50 ${
                  confirmingRotate
                    ? "bg-amber-500/15 text-amber-400"
                    : "text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
                }`}
              >
                <RefreshCw size={10} />
                {confirmingRotate ? "Bekräfta – bryter nuvarande" : "Ny adress"}
              </button>
            </div>
            <button
              onClick={handleRevoke}
              disabled={isPending}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50"
            >
              <Trash2 size={10} />
              Inaktivera
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
