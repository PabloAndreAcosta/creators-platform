"use client";

import { useState, useTransition } from "react";
import { Instagram, Loader2, Check, X } from "lucide-react";
import Image from "next/image";
import { importInstagramMedia } from "./media-actions";
import { useToast } from "@/components/ui/toaster";

interface IgMediaItem {
  ig_id: string;
  media_type: "image" | "video";
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  permalink: string;
}

export function InstagramConnect({
  isConnected,
  instagramUsername,
}: {
  isConnected: boolean;
  instagramUsername: string | null;
}) {
  const { toast } = useToast();
  const [connected, setConnected] = useState(isConnected);
  const [username, setUsername] = useState(instagramUsername);
  const [igMedia, setIgMedia] = useState<IgMediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function fetchMedia(cursor?: string) {
    setLoading(true);
    try {
      const url = cursor
        ? `/api/instagram/media?after=${cursor}`
        : "/api/instagram/media";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        toast.error("Kunde inte hämta", data.error || "Försök igen");
        return;
      }
      const data = await res.json();
      if (cursor) {
        setIgMedia((prev) => [...prev, ...data.items]);
      } else {
        setIgMedia(data.items);
      }
      setNextCursor(data.nextCursor);
    } catch {
      toast.error("Nätverksfel", "Kunde inte nå Instagram");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(igId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(igId)) next.delete(igId);
      else next.add(igId);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === igMedia.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(igMedia.map((m) => m.ig_id)));
    }
  }

  function handleImport() {
    const selected = igMedia.filter((m) => selectedIds.has(m.ig_id));
    if (!selected.length) {
      toast.error("Välj media", "Markera minst en bild eller video att importera.");
      return;
    }

    startTransition(async () => {
      const result = await importInstagramMedia(
        selected.map((m) => ({
          media_url: m.media_url,
          thumbnail_url: m.thumbnail_url,
          caption: m.caption,
          media_type: m.media_type,
        }))
      );

      if (result.error) {
        toast.error("Import misslyckades", result.error);
      } else {
        toast.success(`${selected.length} media importerade`);
        // Remove imported items from preview
        setIgMedia((prev) => prev.filter((m) => !selectedIds.has(m.ig_id)));
        setSelectedIds(new Set());
      }
    });
  }

  async function handleDisconnect() {
    const res = await fetch("/api/instagram/disconnect", { method: "POST" });
    if (res.ok || res.redirected) {
      setConnected(false);
      setUsername(null);
      setIgMedia([]);
      toast.success("Instagram bortkopplat");
    }
  }

  if (!connected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Instagram size={18} className="text-[var(--usha-muted)]" />
          <h3 className="text-sm font-semibold">Instagram-import</h3>
        </div>
        <p className="text-xs text-[var(--usha-muted)]">
          Koppla ditt Instagram Business/Creator-konto för att importera bilder och videos till din portfolio.
        </p>
        <a
          href="/api/instagram/connect"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Instagram size={16} />
          Koppla Instagram
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Instagram size={18} className="text-pink-400" />
          <h3 className="text-sm font-semibold">Instagram-import</h3>
          <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">
            @{username}
          </span>
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
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Instagram size={14} />}
          Hämta media
        </button>

        {igMedia.length > 0 && (
          <>
            <button
              onClick={selectAll}
              className="rounded-xl border border-[var(--usha-border)] px-3 py-2 text-xs transition hover:bg-[var(--usha-border)]"
            >
              {selectedIds.size === igMedia.length ? "Avmarkera alla" : "Markera alla"}
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

      {igMedia.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {igMedia.map((item) => (
              <button
                key={item.ig_id}
                onClick={() => toggleSelect(item.ig_id)}
                className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                  selectedIds.has(item.ig_id)
                    ? "border-[var(--usha-gold)]"
                    : "border-transparent hover:border-[var(--usha-border)]"
                }`}
              >
                <Image
                  src={item.media_type === "video" && item.thumbnail_url ? item.thumbnail_url : item.media_url}
                  alt={item.caption || "Instagram media"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                />
                {selectedIds.has(item.ig_id) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Check size={24} className="text-[var(--usha-gold)]" />
                  </div>
                )}
                {item.media_type === "video" && (
                  <div className="absolute bottom-1 left-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[9px] font-medium uppercase">
                    Video
                  </div>
                )}
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
