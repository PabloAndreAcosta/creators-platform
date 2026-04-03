"use client";

import { useTransition, useState, useRef } from "react";
import { useToast } from "@/components/ui/toaster";
import { CATEGORIES } from "@/lib/categories";
import { createBrowserClient } from "@supabase/ssr";
import { ImagePlus, Loader2, X } from "lucide-react";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  image_url?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  event_location?: string | null;
}

export default function ListingForm({
  listing,
  action,
}: {
  listing?: Listing;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState<string | null>(listing?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const ext = file.name.split(".").pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error } = await supabase.storage
        .from("listing-images")
        .upload(path, file, { upsert: true });

      if (error) {
        toast.error("Uppladdning misslyckades", error.message);
        return;
      }

      const { data: urlData } = supabase.storage.from("listing-images").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
    } catch {
      toast.error("Fel vid uppladdning");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    if (imageUrl) {
      formData.set("image_url", imageUrl);
    }
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) {
        toast.error("Kunde inte spara tjänst", result.error);
      } else {
        toast.success(listing ? "Tjänst sparad" : "Tjänst skapad");
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Image Upload */}
      <div>
        <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">Bild</label>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          className="hidden"
        />
        {imageUrl ? (
          <div className="relative w-full overflow-hidden rounded-xl border border-[var(--usha-border)]" style={{ aspectRatio: "1.91 / 1" }}>
            <img src={imageUrl} alt="Listing" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => { setImageUrl(null); if (fileRef.current) fileRef.current.value = ""; }}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white transition hover:bg-black/80"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-32 w-full items-center justify-center rounded-xl border-2 border-dashed border-[var(--usha-border)] transition hover:border-[var(--usha-gold)]/30 disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 size={20} className="animate-spin text-[var(--usha-muted)]" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-[var(--usha-muted)]">
                <ImagePlus size={20} />
                <span className="text-xs">Ladda upp bild</span>
              </div>
            )}
          </button>
        )}
      </div>

      {/* Title */}
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Titel
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={listing?.title || ""}
          placeholder="t.ex. Privat danslektion"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Beskrivning
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={listing?.description || ""}
          placeholder="Beskriv vad som ingår i tjänsten..."
          className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Category + Price */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Kategori
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={listing?.category || ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          >
            <option value="">Välj kategori...</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="price" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Pris (SEK)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            defaultValue={listing?.price ?? ""}
            placeholder="t.ex. 500"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
      </div>

      {/* Duration */}
      <div className="sm:w-1/2">
        <label htmlFor="duration_minutes" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Längd (minuter)
        </label>
        <input
          id="duration_minutes"
          name="duration_minutes"
          type="number"
          min={0}
          step={15}
          defaultValue={listing?.duration_minutes ?? ""}
          placeholder="t.ex. 60"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Date + Time */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="event_date" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Datum
          </label>
          <input
            id="event_date"
            name="event_date"
            type="date"
            defaultValue={listing?.event_date ?? ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
        <div>
          <label htmlFor="event_time" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Tid
          </label>
          <input
            id="event_time"
            name="event_time"
            type="time"
            defaultValue={listing?.event_time ?? ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
      </div>

      {/* Location */}
      <div>
        <label htmlFor="event_location" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Plats
        </label>
        <input
          id="event_location"
          name="event_location"
          type="text"
          defaultValue={listing?.event_location ?? ""}
          placeholder="t.ex. Kulturhuset, Stockholm eller Online (Zoom)"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Sparar..." : listing ? "Spara ändringar" : "Skapa tjänst"}
        </button>
      </div>
    </form>
  );
}
