"use client";

import { useState } from "react";
import { Facebook, Loader2, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

interface FacebookSyncButtonProps {
  listingId: string;
  facebookEventId: string | null;
  hasPageConnected: boolean;
}

export function FacebookSyncButton({
  listingId,
  facebookEventId,
  hasPageConnected,
}: FacebookSyncButtonProps) {
  const [loading, setLoading] = useState(false);
  const [fbEventUrl, setFbEventUrl] = useState<string | null>(
    facebookEventId ? `https://www.facebook.com/events/${facebookEventId}` : null
  );
  const { toast } = useToast();

  if (!hasPageConnected) {
    return (
      <a
        href="/api/facebook/connect"
        className="flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-4 py-2.5 text-sm text-[var(--usha-muted)] transition hover:border-[#1877F2]/40 hover:text-white"
      >
        <Facebook size={14} className="text-[#1877F2]" />
        Anslut Facebook för att synka
      </a>
    );
  }

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/facebook/sync-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Synk misslyckades", data.error);
      } else {
        setFbEventUrl(data.facebook_event_url);
        toast.success(
          facebookEventId ? "Facebook-event uppdaterat" : "Publicerat på Facebook",
          `Sida: ${data.page_name}`
        );
      }
    } catch {
      toast.error("Fel", "Kunde inte synka med Facebook");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 rounded-xl bg-[#1877F2]/10 border border-[#1877F2]/20 px-4 py-2.5 text-sm font-medium text-[#1877F2] transition hover:bg-[#1877F2]/20 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={14} className="animate-spin" />
        ) : facebookEventId ? (
          <RefreshCw size={14} />
        ) : (
          <Facebook size={14} />
        )}
        {loading
          ? "Synkar..."
          : facebookEventId
          ? "Uppdatera på Facebook"
          : "Publicera på Facebook"}
      </button>

      {fbEventUrl && (
        <a
          href={fbEventUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs text-[var(--usha-muted)] hover:text-white"
        >
          <ExternalLink size={12} />
          Visa
        </a>
      )}
    </div>
  );
}
