"use client";

import { useTransition } from "react";
import { deleteListing, toggleListingActive } from "./actions";
import { useToast } from "@/components/ui/toaster";
import Link from "next/link";
import { Clock, Pencil, Trash2, Crown, Calendar, MapPin } from "lucide-react";
import { CATEGORY_LABELS } from "@/lib/categories";
import { SocialShareButton } from "@/components/social-share-button";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  release_to_gold_at?: string | null;
  event_date?: string | null;
  event_time?: string | null;
  event_location?: string | null;
  user_id?: string;
  created_at: string;
}

export default function ListingRow({ listing }: { listing: Listing }) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleListingActive(listing.id, !listing.is_active);
      if (result.error) {
        toast.error("Kunde inte uppdatera tjänst", result.error);
      } else {
        toast.success(listing.is_active ? "Tjänst inaktiverad" : "Tjänst aktiverad");
      }
    });
  }

  function handleDelete() {
    if (!confirm("Är du säker på att du vill ta bort denna tjänst?")) return;
    startTransition(async () => {
      const result = await deleteListing(listing.id);
      if (result.error) {
        toast.error("Kunde inte ta bort tjänst", result.error);
      } else {
        toast.success("Tjänst borttagen");
      }
    });
  }

  function handleEarlyBird() {
    if (!confirm("Aktivera 48h Gold-exklusiv tillgång för denna tjänst?")) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/listings/early-bird", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: listing.id }),
        });
        const data = await res.json();
        if (data.success) {
          toast.success("Gold-exklusiv tillgång aktiverad (48h)");
        } else {
          toast.error("Misslyckades", data.error);
        }
      } catch {
        toast.error("Något gick fel");
      }
    });
  }

  const hasEarlyBird = listing.release_to_gold_at && new Date(listing.release_to_gold_at) > new Date();

  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-5 transition-colors ${
        listing.is_active
          ? "border-[var(--usha-border)] bg-[var(--usha-card)]"
          : "border-[var(--usha-border)] bg-[var(--usha-card)] opacity-60"
      } ${isPending ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-3">
          <h3 className="truncate font-semibold">{listing.title}</h3>
          <span className="shrink-0 rounded-full border border-[var(--usha-border)] px-2.5 py-0.5 text-xs text-[var(--usha-muted)]">
            {CATEGORY_LABELS[listing.category] || listing.category}
          </span>
          {!listing.is_active && (
            <span className="shrink-0 rounded-full bg-[var(--usha-border)] px-2.5 py-0.5 text-xs text-[var(--usha-muted)]">
              Inaktiv
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--usha-muted)]">
          {listing.price != null && <span>{listing.price} SEK</span>}
          {listing.duration_minutes != null && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {listing.duration_minutes} min
            </span>
          )}
          {listing.event_date && (
            <span className="flex items-center gap-1">
              <Calendar size={12} />
              {new Date(listing.event_date + "T00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
            </span>
          )}
          {listing.event_time && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {listing.event_time.slice(0, 5)}
            </span>
          )}
          {listing.event_location && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {listing.event_location}
            </span>
          )}
        </div>
      </div>

      <div className="ml-4 flex shrink-0 items-center gap-2">
        <SocialShareButton
          title={listing.title}
          description={listing.description ?? undefined}
          url={`${typeof window !== "undefined" ? window.location.origin : ""}/creators/${listing.user_id}`}
          eventDate={listing.event_date}
          eventLocation={listing.event_location}
          price={listing.price}
        />
        {listing.is_active && !hasEarlyBird && (
          <button
            onClick={handleEarlyBird}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-gold)]/30 px-3 py-1.5 text-xs font-medium text-[var(--usha-gold)] transition-colors hover:bg-[var(--usha-gold)]/10"
            title="Ge Guld-medlemmar 48h exklusiv tillgång"
          >
            <Crown size={12} />
            Early Bird
          </button>
        )}
        {hasEarlyBird && (
          <span className="flex items-center gap-1 rounded-full bg-[var(--usha-gold)]/10 px-2.5 py-1 text-[10px] font-medium text-[var(--usha-gold)]">
            <Crown size={10} />
            Gold-exklusiv
          </span>
        )}
        <button
          onClick={handleToggle}
          className="rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--usha-card-hover)]"
        >
          {listing.is_active ? "Inaktivera" : "Aktivera"}
        </button>
        <Link
          href={`/dashboard/listings/${listing.id}/edit`}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card-hover)] hover:text-white"
          aria-label="Redigera tjänst"
        >
          <Pencil size={14} />
        </Link>
        <button
          onClick={handleDelete}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--usha-muted)] transition-colors hover:bg-red-500/10 hover:text-red-400"
          aria-label="Ta bort tjänst"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
