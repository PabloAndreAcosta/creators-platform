"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronDown, Layers, MapPin, Plus } from "lucide-react";
import ListingRow, { type Listing } from "./listing-row";
import { duplicateListing } from "./actions";
import { useToast } from "@/components/ui/toaster";
import { CATEGORY_LABELS } from "@/lib/categories";
import { SocialShareButton } from "@/components/social-share-button";

/** Collapsible card grouping all occurrences of one series under one emblem.
 *  Collapsed by default — expand to manage each occurrence (a ListingRow). */
export default function SeriesCard({ occurrences }: { occurrences: Listing[] }) {
  const t = useTranslations("listingsPage");
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const first = occurrences[0];
  const venue =
    (first as Listing & { event_venue?: string | null }).event_venue ||
    first.event_location?.split(",")[0] ||
    null;

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
    <div className={`rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] ${isPending ? "pointer-events-none opacity-50" : ""}`}>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
            <Layers size={18} className="text-[var(--usha-gold)]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{first.title}</h3>
              <span className="shrink-0 rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--usha-gold)]">
                {t("seriesBadge")}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
              <span>{t("occurrences", { count: occurrences.length })}</span>
              <span>{CATEGORY_LABELS[first.category] || first.category}</span>
              {venue && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} />
                  {venue}
                </span>
              )}
            </div>
          </div>
          <ChevronDown size={18} className={`shrink-0 text-[var(--usha-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
          {(first as Listing & { series_slug?: string | null }).series_slug && (
            <SocialShareButton
              title={first.title}
              description={first.description ?? undefined}
              url={`${typeof window !== "undefined" ? window.location.origin : ""}/series/${(first as Listing & { series_slug?: string | null }).series_slug}`}
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
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-[var(--usha-border)] p-4">
          {occurrences.map((o) => (
            <ListingRow key={o.id} listing={o} />
          ))}
        </div>
      )}
    </div>
  );
}
