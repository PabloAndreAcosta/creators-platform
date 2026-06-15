"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MapPin, Plus } from "lucide-react";
import ListingRow, { type Listing } from "./listing-row";
import { duplicateListing } from "./actions";
import { useToast } from "@/components/ui/toaster";
import { CATEGORY_LABELS } from "@/lib/categories";
import { SocialShareButton } from "@/components/social-share-button";
import { SeriesCard } from "@/components/listings/series-card";

/** Dashboard series card: shared SeriesCard chrome + full ListingRow per
 *  occurrence + series-level share / add-occurrence. */
export default function DashboardSeriesCard({ occurrences }: { occurrences: Listing[] }) {
  const t = useTranslations("listingsPage");
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const first = occurrences[0];
  const venue = first.event_venue || first.event_location?.split(",")[0] || null;

  function addOccurrence() {
    startTransition(async () => {
      const r = await duplicateListing(first.id);
      if (r?.error || !r?.id) {
        toast.error(t("toastDuplicateError"), r?.error);
      } else {
        toast.success(t("toastDuplicated"));
        router.push(`/dashboard/listings/${r.id}/edit`);
      }
    });
  }

  return (
    <SeriesCard
      title={first.title}
      badge={t("seriesBadge")}
      meta={
        <>
          <span>{t("occurrences", { count: occurrences.length })}</span>
          <span>{CATEGORY_LABELS[first.category] || first.category}</span>
          {venue && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {venue}
            </span>
          )}
        </>
      }
      headerActions={
        <>
          {first.series_slug && (
            <SocialShareButton
              title={first.title}
              description={first.description ?? undefined}
              url={`${typeof window !== "undefined" ? window.location.origin : ""}/series/${first.series_slug}`}
              eventLocation={first.event_location}
              price={first.price}
            />
          )}
          <button
            onClick={addOccurrence}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-gold)]/30 px-3 py-1.5 text-xs font-medium text-[var(--usha-gold)] transition-colors hover:bg-[var(--usha-gold)]/10"
          >
            <Plus size={12} />
            {t("addOccurrence")}
          </button>
        </>
      }
    >
      <div className={`space-y-3 p-4 ${isPending ? "pointer-events-none opacity-50" : ""}`}>
        {occurrences.map((o) => (
          <ListingRow key={o.id} listing={o} />
        ))}
      </div>
    </SeriesCard>
  );
}
