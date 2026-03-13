"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { createClient } from "@/lib/supabase/client";
import { EVENT_CATEGORY_LABELS } from "./constants";

interface EventData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  event_tier: string | null;
  image_url: string | null;
}

const CATEGORIES = Object.entries(EVENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

const TIERS = [
  { value: "", label: "Alla kan se" },
  { value: "guld", label: "Guld & Premium" },
  { value: "premium", label: "Endast Premium" },
];

export default function EventForm({
  event,
  action,
  userId,
}: {
  event?: EventData;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  userId: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState<string>(event?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Ogiltig fil", "Välj en bildfil (JPG, PNG eller WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("För stor fil", "Max 5 MB.");
      return;
    }

    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `${userId}/${crypto.randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("event-images")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Uppladdning misslyckades", uploadError.message);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("event-images").getPublicUrl(path);
    setImageUrl(`${urlData.publicUrl}?t=${Date.now()}`);
    setUploading(false);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) {
        toast.error("Kunde inte spara", result.error ?? "Okänt fel");
      }
      // On success, the server action redirects
    });
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--usha-border)] text-[var(--usha-muted)] hover:text-white"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-bold">
          {event ? "Redigera evenemang" : "Nytt evenemang"}
        </h1>
      </div>

      <form action={handleSubmit} className="space-y-5">
        {/* Event image */}
        <div>
          <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Evenemangsbild
          </label>
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className="group relative cursor-pointer overflow-hidden rounded-xl border border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] transition hover:border-[var(--usha-gold)]/40"
          >
            {imageUrl ? (
              <div className="relative aspect-[1.91/1] bg-black">
                <img
                  src={imageUrl}
                  alt="Evenemangsbild"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <ImagePlus size={24} className="text-white" />
                </div>
              </div>
            ) : (
              <div className="flex aspect-[1.91/1] flex-col items-center justify-center gap-2 text-[var(--usha-muted)]">
                {uploading ? (
                  <Loader2 size={24} className="animate-spin" />
                ) : (
                  <>
                    <ImagePlus size={24} />
                    <span className="text-xs">Klicka för att ladda upp bild</span>
                    <span className="text-[10px]">JPG, PNG eller WebP. Max 5 MB. Bäst i 1200x630px (Facebook-format).</span>
                  </>
                )}
              </div>
            )}
          </div>
          {imageUrl && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setImageUrl("");
              }}
              className="mt-2 flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
            >
              <X size={12} />
              Ta bort bild
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <input type="hidden" name="image_url" value={imageUrl} />
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Titel <span className="text-red-400">*</span>
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            defaultValue={event?.title ?? ""}
            placeholder="t.ex. Fredagsmiddag med DJ"
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
            defaultValue={event?.description ?? ""}
            placeholder="Beskriv evenemanget – vad händer, vad ingår, vad ska gäster förvänta sig..."
            className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>

        {/* Category + Price */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="category" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
              Kategori <span className="text-red-400">*</span>
            </label>
            <select
              id="category"
              name="category"
              required
              defaultValue={event?.category ?? ""}
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
              defaultValue={event?.price ?? ""}
              placeholder="t.ex. 350"
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
            />
          </div>
        </div>

        {/* Duration + Tier */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="duration_minutes" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
              Varaktighet (minuter)
            </label>
            <input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              min={0}
              step={15}
              defaultValue={event?.duration_minutes ?? ""}
              placeholder="t.ex. 120"
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
            />
          </div>

          <div>
            <label htmlFor="event_tier" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
              Tillgänglighet
            </label>
            <select
              id="event_tier"
              name="event_tier"
              defaultValue={event?.event_tier ?? ""}
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
            >
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium text-[var(--usha-muted)] transition hover:text-white"
          >
            Avbryt
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex-1 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? "Sparar..." : event ? "Spara ändringar" : "Skapa evenemang"}
          </button>
        </div>
      </form>
    </div>
  );
}
