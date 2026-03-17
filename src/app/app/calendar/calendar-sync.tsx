"use client";

import { useState, useTransition } from "react";
import { Download, Link2, RefreshCw, Trash2, Copy, Check, Smartphone } from "lucide-react";
import { generateCalendarSyncToken, revokeCalendarSyncToken } from "./actions";

interface CalendarSyncProps {
  initialFeedUrl: string | null;
}

export function CalendarSync({ initialFeedUrl }: CalendarSyncProps) {
  const [feedUrl, setFeedUrl] = useState(initialFeedUrl);
  const [copied, setCopied] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateCalendarSyncToken();
      if (result.feedUrl) {
        setFeedUrl(result.feedUrl);
      }
    });
  };

  const handleRevoke = () => {
    startTransition(async () => {
      const result = await revokeCalendarSyncToken();
      if (result.success) {
        setFeedUrl(null);
      }
    });
  };

  const handleCopy = async () => {
    if (!feedUrl) return;
    await navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Link2 size={16} className="text-[var(--usha-gold)]" />
          Synka med din kalender
        </h2>
      </div>

      {!feedUrl ? (
        <div className="space-y-3">
          <p className="text-xs text-[var(--usha-muted)]">
            Synka dina Usha-bokningar med Google Calendar, Apple Calendar eller Outlook.
            Bokningar uppdateras automatiskt.
          </p>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Link2 size={14} />
            {isPending ? "Skapar..." : "Aktivera kalendersynk"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Feed URL */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={feedUrl}
              className="flex-1 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] px-3 py-2 text-xs text-[var(--usha-muted)] font-mono truncate"
            />
            <button
              onClick={handleCopy}
              className="rounded-lg border border-[var(--usha-border)] p-2 text-[var(--usha-muted)] hover:bg-[var(--usha-card-hover)] transition-colors"
              title="Kopiera URL"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/calendar/export"
              download
              className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--usha-card-hover)] transition-colors"
            >
              <Download size={12} />
              Ladda ner .ics
            </a>
            <button
              onClick={handleGenerate}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--usha-card-hover)] transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} />
              Ny URL
            </button>
            <button
              onClick={handleRevoke}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-50"
            >
              <Trash2 size={12} />
              Inaktivera
            </button>
          </div>

          {/* Instructions toggle */}
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="flex items-center gap-1.5 text-xs text-[var(--usha-gold)] hover:underline"
          >
            <Smartphone size={12} />
            {showInstructions ? "Dölj instruktioner" : "Hur lägger jag till i min kalender?"}
          </button>

          {showInstructions && (
            <div className="space-y-3 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] p-3 text-xs text-[var(--usha-muted)]">
              <div>
                <p className="font-semibold text-[var(--usha-text)] mb-1">Google Calendar</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Öppna Google Calendar på datorn</li>
                  <li>Klicka &quot;+&quot; vid &quot;Andra kalendrar&quot; &rarr; &quot;Från webbadress&quot;</li>
                  <li>Klistra in URL:en ovan och klicka &quot;Lägg till kalender&quot;</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-[var(--usha-text)] mb-1">Apple Calendar (Mac/iPhone)</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Öppna Kalender-appen</li>
                  <li>Arkiv &rarr; Ny kalenderprenumeration (Mac) eller Lägg till &rarr; Prenumerera (iPhone)</li>
                  <li>Klistra in URL:en och bekräfta</li>
                </ol>
              </div>
              <div>
                <p className="font-semibold text-[var(--usha-text)] mb-1">Outlook</p>
                <ol className="list-decimal list-inside space-y-0.5">
                  <li>Öppna Outlook Calendar</li>
                  <li>Lägg till kalender &rarr; Prenumerera från webben</li>
                  <li>Klistra in URL:en och spara</li>
                </ol>
              </div>
              <p className="text-[10px] text-[var(--usha-muted)] mt-2">
                Kalendern uppdateras automatiskt. Det kan ta upp till 24 timmar innan ändringar syns i externa kalendrar.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
