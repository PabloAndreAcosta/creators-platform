"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { uploadFile } from "@/lib/storage/upload-client";
import { EVENT_CATEGORY_LABELS } from "./constants";
import PlacesAutocomplete from "@/components/places-autocomplete";

import type { ListingType, ExperienceDetails } from "@/types/database";

interface EventData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  event_tier: string | null;
  image_url: string | null;
  event_date: string | null;
  event_time: string | null;
  event_location: string | null;
  event_end_time: string | null;
  event_lat: number | null;
  event_lng: number | null;
  event_place_id: string | null;
  event_city?: string | null;
  event_venue?: string | null;
  listing_type: ListingType | null;
  open_to_instructors: boolean | null;
  min_guests: number | null;
  max_guests: number | null;
  experience_details: ExperienceDetails | null;
}

const CATEGORIES = Object.entries(EVENT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }));

const TIERS = [
  { value: "", label: "Alla kan se" },
  { value: "guld", label: "Guld & Premium" },
  { value: "premium", label: "Endast Premium" },
];

const LISTING_TYPES: { value: ListingType; label: string }[] = [
  { value: "event", label: "Evenemang" },
  { value: "table_reservation", label: "Bordsbokning" },
  { value: "spa_treatment", label: "SPA-behandling" },
  { value: "group_activity", label: "Gruppaktivitet" },
];

// Auto-derive listing type from category
function suggestListingType(category: string): ListingType {
  switch (category) {
    case "restaurant": return "table_reservation";
    case "spa": case "retreat": return "spa_treatment";
    case "fitness": return "group_activity";
    default: return "event";
  }
}

export default function EventForm({
  event,
  action,
}: {
  event?: EventData;
  action: (
    formData: FormData
  ) => Promise<{ error?: string; locked?: boolean; id?: string } | void>;
  /** Still accepted by callers; upload now happens server-side via the API route. */
  userId?: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [imageUrl, setImageUrl] = useState<string>(event?.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [listingType, setListingType] = useState<ListingType>(
    event?.listing_type ?? suggestListingType(event?.category ?? "")
  );
  const [category, setCategory] = useState(event?.category ?? "");
  const [amenities, setAmenities] = useState<string>(
    (event?.experience_details?.amenities ?? []).join(", ")
  );
  const [included, setIncluded] = useState<string>(
    (event?.experience_details?.included ?? []).join(", ")
  );
  const showGuestFields = ["table_reservation", "spa_treatment", "group_activity"].includes(listingType);
  const isEditing = !!event?.id;
  const [recurring, setRecurring] = useState(false);
  const [recurInterval, setRecurInterval] = useState("weekly");
  const [occurrences, setOccurrences] = useState(4);
  const [fbAutoPost, setFbAutoPost] = useState(true);
  const [openToInstructors, setOpenToInstructors] = useState(event?.open_to_instructors ?? false);

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
    try {
      const url = await uploadFile(file, "event-images");
      setImageUrl(`${url}?t=${Date.now()}`);
    } catch (err) {
      toast.error("Uppladdning misslyckades", err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result && result.error) {
        toast.error("Kunde inte spara", result.error);
        return;
      }
      // Ticketed event pending unlock: it was saved as a draft. Send the host to
      // its dashboard, where they unlock to publish it.
      if (result && result.locked && result.id) {
        toast.info(
          "Lås upp för att publicera",
          "Eventet är sparat som utkast. Lås upp med nycklar för att börja sälja."
        );
        router.push(`/app/events/${result.id}/live`);
        return;
      }
      // Otherwise the server action redirects on success.
    });
  }

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--usha-border)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="text-xl font-bold">
          {event?.id ? "Redigera evenemang" : "Nytt evenemang"}
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

        {/* Date */}
        <div>
          <label htmlFor="event_date" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Datum
          </label>
          <input
            id="event_date"
            name="event_date"
            type="date"
            defaultValue={event?.event_date ?? ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>

        {/* Start + End time */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="event_time" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
              Starttid
            </label>
            <input
              id="event_time"
              name="event_time"
              type="time"
              defaultValue={event?.event_time ?? ""}
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
              defaultValue={event?.event_end_time ?? ""}
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
            />
          </div>
        </div>

        {/* Recurring series — only when creating */}
        {!isEditing && (
          <div className="space-y-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
                className="h-4 w-4 accent-[var(--usha-gold)]"
              />
              <span className="font-medium">Återkommande event (serie)</span>
            </label>
            {recurring && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="recur_interval" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                      Intervall
                    </label>
                    <select
                      id="recur_interval"
                      value={recurInterval}
                      onChange={(e) => setRecurInterval(e.target.value)}
                      className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-bg,var(--usha-card))] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
                    >
                      <option value="weekly">Varje vecka</option>
                      <option value="biweekly">Varannan vecka</option>
                      <option value="monthly">Varje månad</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="occurrences" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                      Antal tillfällen
                    </label>
                    <input
                      id="occurrences"
                      type="number"
                      min={2}
                      max={52}
                      value={occurrences}
                      onChange={(e) => setOccurrences(Math.min(Math.max(parseInt(e.target.value) || 2, 2), 52))}
                      className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-bg,var(--usha-card))] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
                    />
                  </div>
                </div>
                <p className="text-xs text-[var(--usha-muted)]">
                  Skapar {occurrences} tillfällen från startdatumet, samma tid varje gång. Varje tillfälle blir en egen bokningsbar sida.
                </p>
              </>
            )}
          </div>
        )}
        <input type="hidden" name="recurrence" value={recurring ? recurInterval : "none"} />
        <input type="hidden" name="occurrences" value={occurrences} />

        {/* Auto-publish to Facebook — only when creating */}
        {!isEditing && (
          <div className="space-y-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
            <label className="flex cursor-pointer items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                name="fb_auto_post"
                checked={fbAutoPost}
                onChange={(e) => setFbAutoPost(e.target.checked)}
                className="h-4 w-4 accent-[var(--usha-gold)]"
              />
              <span className="font-medium">Publicera automatiskt på Facebook</span>
            </label>
            <p className="text-xs text-[var(--usha-muted)]">
              {recurring
                ? "Varje tillfälle publiceras automatiskt på din kopplade Facebook-sida ~3 dagar innan dess datum — en jämn ström av påminnelser istället för allt på en gång."
                : "Eventet publiceras automatiskt på din kopplade Facebook-sida ~3 dagar innan datumet. Kräver en ansluten Facebook-sida."}
            </p>
          </div>
        )}

        {/* Open to instructors — shown on both create and edit */}
        <div className="space-y-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="open_to_instructors"
              checked={openToInstructors}
              onChange={(e) => setOpenToInstructors(e.target.checked)}
              className="h-4 w-4 accent-[var(--usha-gold)]"
            />
            <span className="font-medium">Öppna för instruktörer</span>
          </label>
          <p className="text-xs text-[var(--usha-muted)]">
            Låt betalande instruktörer erbjuda betalda minisessioner (15–60 min) på ditt event.
            Deltagare köper minuter direkt av instruktören. Du tar ingen del av deras intäkt.
          </p>
        </div>

        {/* Location with Google Places Autocomplete */}
        <PlacesAutocomplete
          defaultValue={event?.event_location ?? ""}
          defaultLat={event?.event_lat}
          defaultLng={event?.event_lng}
          defaultPlaceId={event?.event_place_id}
          defaultCity={event?.event_city ?? null}
          defaultVenue={event?.event_venue ?? null}
        />

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
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setListingType(suggestListingType(e.target.value));
              }}
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

        {/* Listing type */}
        <div>
          <label htmlFor="listing_type" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Typ av upplevelse
          </label>
          <select
            id="listing_type"
            name="listing_type"
            value={listingType}
            onChange={(e) => setListingType(e.target.value as ListingType)}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          >
            {LISTING_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Guest capacity (only for relevant types) */}
        {showGuestFields && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="min_guests" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                Min antal gäster
              </label>
              <input
                id="min_guests"
                name="min_guests"
                type="number"
                min={1}
                defaultValue={event?.min_guests ?? 1}
                className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
              />
            </div>
            <div>
              <label htmlFor="max_guests" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
                Max antal gäster
              </label>
              <input
                id="max_guests"
                name="max_guests"
                type="number"
                min={1}
                defaultValue={event?.max_guests ?? ""}
                placeholder="Obegränsat"
                className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
              />
            </div>
          </div>
        )}

        {/* Experience details */}
        <div>
          <label htmlFor="amenities" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Bekvämligheter <span className="text-xs">(kommaseparerat)</span>
          </label>
          <input
            id="amenities"
            name="amenities"
            type="text"
            value={amenities}
            onChange={(e) => setAmenities(e.target.value)}
            placeholder="t.ex. Wi-Fi, Parkering, Garderob, Rullstolsanpassat"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>

        <div>
          <label htmlFor="included" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Vad ingår <span className="text-xs">(kommaseparerat)</span>
          </label>
          <input
            id="included"
            name="included"
            type="text"
            value={included}
            onChange={(e) => setIncluded(e.target.value)}
            placeholder="t.ex. 3-rätters meny, Välkomstdrink, Entré"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium text-[var(--usha-muted)] transition hover:text-[var(--usha-white)]"
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
