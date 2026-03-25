"use client";

import { useState, useTransition } from "react";
import { Facebook, Loader2, Check } from "lucide-react";
import Image from "next/image";
import { importFacebookMedia } from "./media-actions";
import { useToast } from "@/components/ui/toaster";

interface FbMediaItem {
  fb_id: string;
  media_type: "image";
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
}

export function FacebookMediaConnect({
  isConnected,
  pageName,
}: {
  isConnected: boolean;
  pageName: string | null;
}) {
  const { toast } = useToast();
  const [fbMedia, setFbMedia] = useState<FbMediaItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function fetchMedia(cursor?: string) {
    setLoading(true);
    try {
      const url = cursor
        ? `/api/facebook/media?after=${cursor}`
        : "/api/facebook/media";
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json();
        toast.error("Kunde inte hämta", data.error || "Försök igen");
        return;
      }
      const data = await res.json();
      if (cursor) {
        setFbMedia((prev) => [...prev, ...data.items]);
      } else {
        setFbMedia(data.items);
      }
      setNextCursor(data.nextCursor);
    } catch {
      toast.error("Nätverksfel", "Kunde inte nå Facebook");
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(fbId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(fbId)) next.delete(fbId);
      else next.add(fbId);
      return next;
    });
  }

  function selectAll() {
    if (selectedIds.size === fbMedia.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(fbMedia.map((m) => m.fb_id)));
    }
  }

  function handleImport() {
    const selected = fbMedia.filter((m) => selectedIds.has(m.fb_id));
    if (!selected.length) {
      toast.error("Välj media", "Markera minst en bild att importera.");
      return;
    }

    startTransition(async () => {
      const result = await importFacebookMedia(
        selected.map((m) => ({
          media_url: m.media_url,
          thumbnail_url: m.thumbnail_url,
          caption: m.caption,
        }))
      );

      if (result.error) {
        toast.error("Import misslyckades", result.error);
      } else {
        toast.success(`${selected.length} bilder importerade`);
        setFbMedia((prev) => prev.filter((m) => !selectedIds.has(m.fb_id)));
        setSelectedIds(new Set());
      }
    });
  }

  if (!isConnected) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Facebook size={18} className="text-[var(--usha-muted)]" />
          <h3 className="text-sm font-semibold">Facebook-import</h3>
        </div>
        <p className="text-xs text-[var(--usha-muted)]">
          Koppla din Facebook-sida för att importera bilder till din portfolio.
        </p>
        <a
          href="/api/facebook/connect"
          className="inline-flex items-center gap-2 rounded-xl bg-[#1877F2] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Facebook size={16} />
          Koppla Facebook
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Facebook size={18} className="text-[#1877F2]" />
          <h3 className="text-sm font-semibold">Facebook-import</h3>
          {pageName && (
            <span className="rounded-full bg-[#1877F2]/15 px-2 py-0.5 text-[10px] font-bold text-[#1877F2]">
              {pageName}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => fetchMedia()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-4 py-2 text-sm transition hover:bg-[var(--usha-border)]"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Facebook size={14} />}
          Hämta media
        </button>

        {fbMedia.length > 0 && (
          <>
            <button
              onClick={selectAll}
              className="rounded-xl border border-[var(--usha-border)] px-3 py-2 text-xs transition hover:bg-[var(--usha-border)]"
            >
              {selectedIds.size === fbMedia.length ? "Avmarkera alla" : "Markera alla"}
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

      {fbMedia.length > 0 && (
        <>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {fbMedia.map((item) => (
              <button
                key={item.fb_id}
                onClick={() => toggleSelect(item.fb_id)}
                className={`group relative aspect-square overflow-hidden rounded-lg border-2 transition ${
                  selectedIds.has(item.fb_id)
                    ? "border-[var(--usha-gold)]"
                    : "border-transparent hover:border-[var(--usha-border)]"
                }`}
              >
                {item.media_url && (
                  <Image
                    src={item.thumbnail_url || item.media_url}
                    alt={item.caption || "Facebook media"}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, 20vw"
                  />
                )}
                {selectedIds.has(item.fb_id) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Check size={24} className="text-[var(--usha-gold)]" />
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
