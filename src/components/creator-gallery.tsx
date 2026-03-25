"use client";

import { useState } from "react";
import Image from "next/image";
import { X, Play, Instagram, Music } from "lucide-react";

interface MediaItem {
  id: string;
  media_type: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  is_hero?: boolean;
  section?: string | null;
}

export function CreatorGallery({ media }: { media: MediaItem[] }) {
  const [lightbox, setLightbox] = useState<MediaItem | null>(null);

  if (media.length === 0) return null;

  const heroItem = media.find((m) => m.is_hero);
  const nonHeroItems = media.filter((m) => !m.is_hero);

  // Group by section
  const sections = new Map<string, MediaItem[]>();
  const unsectioned: MediaItem[] = [];
  for (const item of nonHeroItems) {
    if (item.section) {
      const existing = sections.get(item.section) || [];
      existing.push(item);
      sections.set(item.section, existing);
    } else {
      unsectioned.push(item);
    }
  }

  function getEmbedUrl(item: MediaItem): string | null {
    if (item.media_type === "youtube") {
      const match = item.url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]+)/);
      return match ? `https://www.youtube-nocookie.com/embed/${match[1]}?autoplay=1` : null;
    }
    if (item.media_type === "vimeo") {
      const match = item.url.match(/vimeo\.com\/(\d+)/);
      return match ? `https://player.vimeo.com/video/${match[1]}?autoplay=1` : null;
    }
    if (item.media_type === "instagram") {
      const match = item.url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
      return match ? `https://www.instagram.com/p/${match[1]}/embed` : null;
    }
    if (item.media_type === "instagram-profile") {
      return item.url;
    }
    if (item.media_type === "tiktok") {
      // url contains embed_link or share_url
      return item.url.includes("embed") ? item.url : null;
    }
    return null;
  }

  function renderMediaCard(item: MediaItem) {
    return (
      <button
        key={item.id}
        onClick={() => setLightbox(item)}
        className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition hover:border-[var(--usha-gold)]/30"
      >
        {item.media_type === "image" && (
          <Image src={item.url} alt={item.caption || ""} fill className="object-cover" />
        )}
        {item.media_type === "video" && (
          <>
            <video src={item.url} className="h-full w-full object-cover" muted playsInline />
            <div className="absolute inset-0 flex items-center justify-center">
              <Play size={24} className="text-white drop-shadow-lg" />
            </div>
          </>
        )}
        {(item.media_type === "youtube" || item.media_type === "vimeo") && (
          <>
            {item.thumbnail_url ? (
              <Image src={item.thumbnail_url} alt={item.caption || ""} fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[var(--usha-muted)]">
                <Play size={24} />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <Play size={24} className="text-white drop-shadow-lg" />
            </div>
          </>
        )}
        {item.media_type === "tiktok" && (
          <>
            {item.thumbnail_url ? (
              <Image src={item.thumbnail_url} alt={item.caption || ""} fill className="object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-cyan-500/20 to-pink-500/20">
                <Music size={24} className="text-white/60" />
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
              <Play size={24} className="text-white drop-shadow-lg" />
            </div>
          </>
        )}
        {item.media_type === "instagram" && (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-600/20 to-pink-500/20 text-[var(--usha-muted)]">
            <span className="text-2xl">IG</span>
          </div>
        )}
        {item.media_type === "instagram-profile" && (() => {
          const usernameMatch = item.url.match(/instagram\.com\/([A-Za-z0-9._]+)/);
          const igUsername = usernameMatch ? usernameMatch[1] : null;
          return (
            <div className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-600/20 to-pink-500/20">
              <Instagram size={28} className="text-pink-400" />
              {igUsername && (
                <span className="text-xs font-medium text-white/80">@{igUsername}</span>
              )}
            </div>
          );
        })()}

        {item.media_type !== "image" && (
          <div className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-medium uppercase text-white">
            {item.media_type}
          </div>
        )}

        {item.caption && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 opacity-0 transition group-hover:opacity-100">
            <p className="text-[10px] text-white/90">{item.caption}</p>
          </div>
        )}
      </button>
    );
  }

  function renderGrid(items: MediaItem[]) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {items.map(renderMediaCard)}
      </div>
    );
  }

  return (
    <>
      {/* Hero image */}
      {heroItem && (
        <button
          onClick={() => setLightbox(heroItem)}
          className="group relative mb-4 aspect-[21/9] w-full overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition hover:border-[var(--usha-gold)]/30"
        >
          {heroItem.media_type === "image" && (
            <Image src={heroItem.url} alt={heroItem.caption || ""} fill className="object-cover" />
          )}
          {heroItem.media_type === "video" && (
            <>
              <video src={heroItem.url} className="h-full w-full object-cover" muted playsInline autoPlay loop />
              <div className="absolute inset-0 flex items-center justify-center">
                <Play size={40} className="text-white drop-shadow-lg" />
              </div>
            </>
          )}
          {(heroItem.media_type === "youtube" || heroItem.media_type === "vimeo") && heroItem.thumbnail_url && (
            <>
              <Image src={heroItem.thumbnail_url} alt={heroItem.caption || ""} fill className="object-cover" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Play size={40} className="text-white drop-shadow-lg" />
              </div>
            </>
          )}
          {heroItem.caption && (
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4 pt-10 opacity-0 transition group-hover:opacity-100">
              <p className="text-sm text-white/90">{heroItem.caption}</p>
            </div>
          )}
        </button>
      )}

      {/* Sectioned content */}
      {Array.from(sections.entries()).map(([sectionName, items]) => (
        <div key={sectionName} className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-[var(--usha-muted)]">{sectionName}</h3>
          {renderGrid(items)}
        </div>
      ))}

      {/* Unsectioned content */}
      {unsectioned.length > 0 && renderGrid(unsectioned)}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 transition hover:bg-white/20"
          >
            <X size={20} />
          </button>

          <div
            className="max-h-[90vh] max-w-[90vw] overflow-hidden rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.media_type === "image" && (
              <img
                src={lightbox.url}
                alt={lightbox.caption || ""}
                className="max-h-[85vh] max-w-[90vw] object-contain"
              />
            )}
            {lightbox.media_type === "video" && (
              <video
                src={lightbox.url}
                controls
                autoPlay
                className="max-h-[85vh] max-w-[90vw]"
              />
            )}
            {(lightbox.media_type === "youtube" || lightbox.media_type === "vimeo" || lightbox.media_type === "instagram" || lightbox.media_type === "instagram-profile" || lightbox.media_type === "tiktok") && (
              <iframe
                src={getEmbedUrl(lightbox) || ""}
                className="h-[70vh] w-[90vw] max-w-3xl"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            )}

            {lightbox.caption && (
              <div className="bg-black/80 p-3">
                <p className="text-sm text-white/80">{lightbox.caption}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
