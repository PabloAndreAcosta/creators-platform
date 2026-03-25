"use client";

import { useState, useRef, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toaster";
import { Plus, X, Image as ImageIcon, Film, Loader2, GripVertical, Instagram, Star } from "lucide-react";
import Image from "next/image";
import { addMedia, removeMedia, reorderMedia, toggleHero, updateMediaSection } from "./media-actions";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface MediaItem {
  id: string;
  media_type: string;
  url: string;
  thumbnail_url: string | null;
  caption: string | null;
  sort_order: number;
  is_hero?: boolean;
  section?: string | null;
}

interface MediaGalleryProps {
  userId: string;
  initialMedia: MediaItem[];
}

function getEmbedUrl(url: string): { type: string; embedUrl: string; thumbnail?: string } | null {
  const igPostMatch = url.match(/instagram\.com\/(?:p|reel)\/([A-Za-z0-9_-]+)/);
  if (igPostMatch) {
    return { type: "instagram", embedUrl: `https://www.instagram.com/p/${igPostMatch[1]}/embed` };
  }
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
      thumbnail: `https://vumbnail.com/${vimeoMatch[1]}.jpg`,
    };
  }
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]+)/);
  if (ytMatch) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
      thumbnail: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
    };
  }
  return null;
}

function SortableMediaCard({
  item,
  onRemove,
  onToggleHero,
  onSectionChange,
  sections,
  isPending,
}: {
  item: MediaItem;
  onRemove: (id: string) => void;
  onToggleHero: (id: string) => void;
  onSectionChange: (id: string, section: string) => void;
  sections: string[];
  isPending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="group relative aspect-square overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)]">
      {item.media_type === "image" && (
        <Image src={item.url} alt={item.caption || ""} fill className="object-cover" />
      )}
      {item.media_type === "video" && (
        <video src={item.url} className="h-full w-full object-cover" muted playsInline />
      )}
      {(item.media_type === "youtube" || item.media_type === "vimeo") && (
        <Image src={item.thumbnail_url || "/placeholder.jpg"} alt={item.caption || ""} fill className="object-cover" />
      )}
      {item.media_type === "instagram" && (
        <div className="flex h-full items-center justify-center bg-gradient-to-br from-purple-600/20 to-pink-500/20 text-[var(--usha-muted)]">
          <Film size={24} />
        </div>
      )}
      {item.media_type === "instagram-profile" && (() => {
        const usernameMatch = item.url.match(/instagram\.com\/([A-Za-z0-9._]+)/);
        const igUsername = usernameMatch ? usernameMatch[1] : null;
        return (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-600/20 to-pink-500/20 transition hover:from-purple-600/30 hover:to-pink-500/30"
            onClick={(e) => e.stopPropagation()}
          >
            <Instagram size={28} className="text-pink-400" />
            {igUsername && <span className="text-xs font-medium text-white/80">@{igUsername}</span>}
          </a>
        );
      })()}

      {/* Type badge */}
      {item.media_type !== "image" && (
        <div className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[9px] font-medium uppercase">
          {item.media_type}
        </div>
      )}

      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-2 top-2 z-10 cursor-grab rounded-full bg-black/70 p-1.5 opacity-0 transition group-hover:opacity-100 active:cursor-grabbing"
      >
        <GripVertical size={14} />
      </button>

      {/* Hero toggle */}
      <button
        type="button"
        onClick={() => onToggleHero(item.id)}
        disabled={isPending}
        className={`absolute left-10 top-2 z-10 rounded-full p-1.5 transition ${
          item.is_hero
            ? "bg-[var(--usha-gold)] text-black"
            : "bg-black/70 opacity-0 group-hover:opacity-100"
        }`}
        title={item.is_hero ? "Ta bort som omslagsbild" : "Sätt som omslagsbild"}
      >
        <Star size={14} fill={item.is_hero ? "currentColor" : "none"} />
      </button>

      {/* Remove button */}
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="absolute right-2 top-2 z-10 rounded-full bg-black/70 p-1.5 transition hover:bg-red-500/80"
      >
        <X size={14} />
      </button>

      {/* Section selector */}
      <div className="absolute bottom-2 right-2 z-10 opacity-0 transition group-hover:opacity-100">
        <input
          type="text"
          value={item.section || ""}
          onChange={(e) => onSectionChange(item.id, e.target.value)}
          placeholder="Sektion"
          list="media-sections"
          className="w-20 rounded-full bg-black/70 px-2 py-0.5 text-[9px] text-white outline-none placeholder:text-white/50 focus:w-28"
        />
      </div>

      {/* Caption */}
      {item.caption && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 pt-6">
          <p className="text-[10px] text-white/80">{item.caption}</p>
        </div>
      )}
    </div>
  );
}

export function MediaGallery({ userId, initialMedia }: MediaGalleryProps) {
  const { toast } = useToast();
  const [media, setMedia] = useState<MediaItem[]>(initialMedia);
  const [uploading, setUploading] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const [embedCaption, setEmbedCaption] = useState("");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  // Collect unique sections for datalist
  const sections = Array.from(new Set(media.map((m) => m.section).filter(Boolean) as string[]));

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    const supabase = createClient();

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("För stor fil", `${file.name} är över 50 MB.`);
        continue;
      }

      const isVideo = file.type.startsWith("video/");
      const ext = file.name.split(".").pop();
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("creator-media")
        .upload(path, file, { upsert: false });

      if (uploadError) {
        toast.error("Uppladdning misslyckades", uploadError.message);
        continue;
      }

      const { data: urlData } = supabase.storage.from("creator-media").getPublicUrl(path);

      startTransition(async () => {
        const result = await addMedia({
          media_type: isVideo ? "video" : "image",
          url: urlData.publicUrl,
          thumbnail_url: null,
          caption: null,
        });
        if (result.data) {
          setMedia((prev) => [...prev, result.data!]);
        }
      });
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleAddEmbed() {
    const trimmed = embedUrl.trim();
    if (!trimmed) return;

    const parsed = getEmbedUrl(trimmed);
    if (!parsed) {
      toast.error("Ogiltig URL", "Ange en giltig Instagram, Vimeo eller YouTube-länk.");
      return;
    }

    startTransition(async () => {
      const result = await addMedia({
        media_type: parsed.type,
        url: trimmed,
        thumbnail_url: parsed.thumbnail || null,
        caption: embedCaption || null,
      });
      if (result.data) {
        setMedia((prev) => [...prev, result.data!]);
        setEmbedUrl("");
        setEmbedCaption("");
        toast.success("Media tillagd");
      } else if (result.error) {
        toast.error("Kunde inte spara", result.error);
      }
    });
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      const result = await removeMedia(id);
      if (result.success) {
        setMedia((prev) => prev.filter((m) => m.id !== id));
      } else {
        toast.error("Kunde inte ta bort", result.error || "");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setMedia((prev) => {
      const oldIndex = prev.findIndex((m) => m.id === active.id);
      const newIndex = prev.findIndex((m) => m.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);

      // Save new order to server (non-blocking)
      startTransition(async () => {
        const result = await reorderMedia(reordered.map((m) => m.id));
        if (result.error) {
          toast.error("Kunde inte spara ordning", result.error);
        }
      });

      return reordered;
    });
  }

  function handleToggleHero(id: string) {
    startTransition(async () => {
      const result = await toggleHero(id);
      if (result.success) {
        setMedia((prev) =>
          prev.map((m) => ({
            ...m,
            is_hero: m.id === id ? !m.is_hero : false,
          }))
        );
      } else {
        toast.error("Kunde inte ändra omslagsbild", result.error || "");
      }
    });
  }

  function handleSectionChange(id: string, section: string) {
    // Update locally immediately
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, section: section || null } : m)));

    // Debounce save — save on blur instead (handled by input's onChange + server action)
    startTransition(async () => {
      await updateMediaSection(id, section || null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">Portfolio</h2>
        <p className="text-[10px] text-[var(--usha-muted)]">Dra för att ändra ordning</p>
      </div>

      {/* Upload buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-4 py-2.5 text-sm font-medium transition hover:border-[var(--usha-gold)]/40 hover:text-white disabled:opacity-50"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
          Ladda upp bilder/videos
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Embed URL input */}
      <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
        <p className="mb-2 text-xs text-[var(--usha-muted)]">
          Lägg till från Instagram, Vimeo eller YouTube
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="https://www.instagram.com/p/..., https://vimeo.com/... eller https://youtube.com/..."
            className="flex-1 min-h-[44px] rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
          <button
            type="button"
            onClick={handleAddEmbed}
            disabled={isPending || !embedUrl.trim()}
            className="flex shrink-0 items-center gap-1 rounded-xl bg-[var(--usha-gold)] px-4 py-2 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            <Plus size={16} />
          </button>
        </div>
        <input
          type="text"
          value={embedCaption}
          onChange={(e) => setEmbedCaption(e.target.value)}
          placeholder="Bildtext (valfritt)"
          className="mt-2 w-full min-h-[40px] rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-2 text-xs outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Sections datalist */}
      <datalist id="media-sections">
        {sections.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      {/* Gallery grid with drag-and-drop */}
      {media.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={media.map((m) => m.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {media.map((item) => (
                <SortableMediaCard
                  key={item.id}
                  item={item}
                  onRemove={handleRemove}
                  onToggleHero={handleToggleHero}
                  onSectionChange={handleSectionChange}
                  sections={sections}
                  isPending={isPending}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {media.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--usha-border)] py-12 text-center">
          <ImageIcon size={32} className="mx-auto mb-2 text-[var(--usha-muted)]" />
          <p className="text-sm text-[var(--usha-muted)]">
            Lägg till bilder, videos eller Instagram/Vimeo-inlägg
          </p>
        </div>
      )}
    </div>
  );
}
