"use client";

import { useTransition, useState, useRef } from "react";
import { useToast } from "@/components/ui/toaster";
import { CATEGORIES } from "@/lib/categories";
import { uploadFile } from "@/lib/storage/upload-client";
import { ImagePlus, Loader2, X } from "lucide-react";
import PlacesAutocomplete from "@/components/places-autocomplete";

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
  event_end_time?: string | null;
  event_location?: string | null;
  event_lat?: number | null;
  event_lng?: number | null;
  event_place_id?: string | null;
  listing_type?: string | null;
  dance_count?: number | null;
}

export default function ListingForm({
  listing,
  action,
  creatorSubcategory,
}: {
  listing?: Listing;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  creatorSubcategory?: string | null;
}) {
  const isTaxiDancer = creatorSubcategory === "taxi_dancer";
  const [listingType, setListingType] = useState<string>(
    listing?.listing_type ?? (isTaxiDancer ? "dance_package" : "service")
  );
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
      const url = await uploadFile(file, "listing-images");
      setImageUrl(url);
    } catch (err) {
      toast.error("Uppladdning misslyckades", err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    if (imageUrl) {
      formData.set("image_url", imageUrl);
    }
    formData.set("listing_type", listingType);
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

      {/* Listing type — only for taxi_dancer creators */}
      {isTaxiDancer && (
        <div>
          <label htmlFor="listing_type" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Typ av tjänst
          </label>
          <select
            id="listing_type"
            value={listingType}
            onChange={(e) => setListingType(e.target.value)}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          >
            <option value="dance_package">Danspaket (förbetalt — inlöses på event)</option>
            <option value="coaching_session">Coachning (privatlektion med tid)</option>
            <option value="b2b_offering">B2B-event (arrangör bokar för kväll/event)</option>
            <option value="service">Annan tjänst</option>
          </select>
          {listingType === "dance_package" && (
            <>
              <p className="mt-1.5 text-xs text-[var(--usha-muted)]">
                Kunden betalar i förväg och inlöser danserna på ett event. Inget specifikt datum krävs vid bokning.
              </p>
              <div className="mt-3">
                <label htmlFor="dance_count" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                  Antal danser i paketet
                </label>
                <input
                  id="dance_count"
                  name="dance_count"
                  type="number"
                  min={1}
                  step={1}
                  required
                  defaultValue={listing?.dance_count ?? 5}
                  placeholder="t.ex. 5"
                  className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
                />
              </div>
            </>
          )}
          {listingType === "coaching_session" && (
            <p className="mt-1.5 text-xs text-[var(--usha-muted)]">
              Kunden bokar en specifik tid utifrån din tillgänglighet i kalendern.
            </p>
          )}
          {listingType === "b2b_offering" && (
            <p className="mt-1.5 text-xs text-[var(--usha-muted)]">
              Arrangörer (lokaler, danspalats, eventbolag) kan boka dig för en specifik kväll eller ett event. Pris du anger är ditt baspris — arrangören anger datum, tid och lokal vid bokning.
            </p>
          )}
        </div>
      )}

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

      {/* Date */}
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

      {/* Start + End time */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="event_time" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Starttid
          </label>
          <input
            id="event_time"
            name="event_time"
            type="time"
            defaultValue={listing?.event_time ?? ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
        <div>
          <label htmlFor="event_end_time" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Sluttid
          </label>
          <input
            id="event_end_time"
            name="event_end_time"
            type="time"
            defaultValue={listing?.event_end_time ?? ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
      </div>

      {/* Location with Google Places Autocomplete */}
      <PlacesAutocomplete
        defaultValue={listing?.event_location ?? ""}
        defaultLat={listing?.event_lat}
        defaultLng={listing?.event_lng}
        defaultPlaceId={listing?.event_place_id}
      />

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
