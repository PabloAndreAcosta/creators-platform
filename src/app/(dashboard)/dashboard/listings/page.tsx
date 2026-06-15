import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, ScanLine } from "lucide-react";
import ListingRow, { type Listing } from "./listing-row";
import SeriesCard from "./series-card";
import { NoListings } from "@/components/ui/empty-state";

export default async function ListingsPage() {
  const t = await getTranslations("listingsPage");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Group occurrences that share a series_id so a series renders as one
  // collapsible card instead of N flat rows.
  const all = (listings ?? []) as Listing[];
  const seriesGroups = new Map<string, Listing[]>();
  for (const l of all) {
    if (l.series_id) {
      const g = seriesGroups.get(l.series_id) ?? [];
      g.push(l);
      seriesGroups.set(l.series_id, g);
    }
  }
  const renderedSeries = new Set<string>();

  return (
    <>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
          >
            <ArrowLeft size={14} />
            {t("back")}
          </Link>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-[var(--usha-muted)]">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/app/scan"
            className="flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-5 py-2.5 text-sm font-semibold text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/60 hover:text-[var(--usha-gold)]"
          >
            <ScanLine size={16} />
            {t("scanTickets")}
          </Link>
          <Link
            href="/dashboard/listings/new"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-bold text-black transition hover:opacity-90"
          >
            <Plus size={16} />
            {t("newListing")}
          </Link>
        </div>
      </div>

      {all.length === 0 ? (
        <NoListings />
      ) : (
        <div className="space-y-3">
          {all.map((listing) => {
            if (listing.series_id) {
              if (renderedSeries.has(listing.series_id)) return null;
              renderedSeries.add(listing.series_id);
              const occ = [...(seriesGroups.get(listing.series_id) ?? [])].sort(
                (a, b) => (a.event_date || "").localeCompare(b.event_date || "")
              );
              return <SeriesCard key={`series-${listing.series_id}`} occurrences={occ} />;
            }
            return <ListingRow key={listing.id} listing={listing} />;
          })}
        </div>
      )}
    </>
  );
}
