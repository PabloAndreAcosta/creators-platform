"use client";

import { useState, useTransition } from "react";
import { Music, Loader2, Check } from "lucide-react";
import Image from "next/image";
import { importTikTokMedia } from "./media-actions";
import { useToast } from "@/components/ui/toaster";

interface TikTokMediaItem {
  tiktok_id: string;
  media_type: "video";
  media_url: string;
  embed_url: string | null;
  thumbnail_url: string | null;
  caption: string | null;
}

export function TikTokConnect({
  isConnected,
  tiktokUsername,
}: {
  isConnected: boolean;
  tiktokUsername: string | null;
}) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(isConnected);
  const [username, setUsername] = useState(tiktokUsername);
  const [ttMedia, setTtMedia] = useState<TikTokMediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function fetchMedia(cursor?: string) {
    setLoading(true);
    try {
      const url = cursor
        ? `/api/tiktok/media?cursor=${cursor}`
        : "/api/tiktok/media";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        toast.error("Kunde inte hämta", data.error || "Försök igen");
        return;
      }
      const data = await res.json();
      if (cursor) {
        setTtMedia((prev) => [...prev, ...data.items]);
      } else {
        setTtMedia(data.items);
      }
      setNextCursor(data.nextCursor);
    } catch {
      toast.error("Nätverksfel", "Kunde inte nå TikTok");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === ttMedia.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ttMedia.map((m) => m.tiktok_id)));
    }
  }

  function handleImport() {
    const selected = ttMedia.filter((m) => selectedIds.has(m.tiktok_id));
    if (!selected.length) {
      toast.error("Välj media", "Markera minst en video att importera.");
      return;
    }

    startTransition(async () => {
      const result = await importTikTokMedia(
        selected.map((m) => ({
          media_url: m.media_url,
          embed_url: m.embed_url,
          thumbnail_url: m.thumbnail_url,
          caption: m.caption,
        }))
      );

      if (result.error) {
        toast.error("Import misslyckades", result.error);
      } else {
        toast.success(`${selected.length} videos importerade`);
        setTtMedia((prev) => prev.filter((m) => !selectedIds.has(m.tiktok_id)));
        setSelectedIds(new Set());
      }
    });
  }

  async function handleDisconnect() {
    const res = await fetch("/api/tiktok/disconnect", { method: "POST" });
    if (res.ok || res.redirected) {
      setConnected(false);
      setUsername(null);
      setTtMedia([]);
      toast.success("TikTok bortkopplat");
    }
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Music size={18} className="text-[var(--usha-muted)]" />
          <h3 className="text-sm font-semibold">TikTok-import</h3>
        </div>
        <p className="text-xs text-[var(--usha-muted)]">
          Koppla ditt TikTok-konto för att importera videos till din portfolio.
        </p>
        <a
          href="/api/tiktok/connect"
          className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-sm font-medium text-white ring-1 ring-white/20 transition hover:ring-white/40"
        >
          <Music size={16} />
          Koppla TikTok
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music size={18} />
          <h3 className="text-sm font-semibold">TikTok-import</h3>
          {username && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold">
              @{username}
            </span>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          className="text-xs text-[var(--usha-muted)] hover:text-red-400 transition"
        >
          Koppla bort
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => fetchMedia()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-4 py-2 text-sm transition hover:bg-[var(--usha-border)]"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Music size={14} />}
          Hämta videos
        </button>

        {ttMedia.length > 0 && (
          <>
            <button
              onClick={selectAll}
              className="rounded-xl border border-[var(--usha-border)] px-3 py-2 text-xs transition hover:bg-[var(--usha-border)]"
            >
              {selectedIds.size === ttMedia.length ? "Avmarkera alla" : "Markera alla"}
            </button>
            <button
              onClick={handleImport}
              disabled={selectedIds.size === 0 || isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--usha-gold)] px-4 py-2 text-sm font-medium text-black transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Importera valda ({selectedIds.size})
            </button>
          </>
        )}
      </div>

      {ttMedia.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {ttMedia.map((item) => (
              <button
                key={item.tiktok_id}
                onClick={() => toggleSelect(item.tiktok_id)}
                className={`group relative aspect-[9/16] overflow-hidden rounded-lg border-2 transition ${
                  selectedIds.has(item.tiktok_id)
                    ? "border-[var(--usha-gold)]"
                    : "border-transparent hover:border-[var(--usha-border)]"
                }`}
              >
                {item.thumbnail_url && (
                  <Image
                    src={item.thumbnail_url}
                    alt={item.caption || "TikTok video"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                  />
                )}
                {selectedIds.has(item.tiktok_id) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Check size={24} className="text-[var(--usha-gold)]" />
                  </div>
                )}
                <div className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase">
                  Video
                </div>
              </button>
            ))}
          </div>

          {nextCursor && (
            <button
              onClick={() => fetchMedia(nextCursor)}
              disabled={loading}
              className="w-full rounded-xl border border-[var(--usha-border)] py-2 text-sm text-[var(--usha-muted)] transition hover:bg-[var(--usha-border)]"
            >
              {loading ? "Laddar..." : "Visa fler"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
