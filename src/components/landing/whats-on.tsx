import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { ListingCard } from "@/components/listing-card";
import { BROWSABLE_TYPES } from "@/lib/listings/browse";
import { upcomingOrUndated } from "@/lib/listings/time-window";
import { getBookingCounts } from "@/lib/listings/popularity";

/**
 * Vad som händer — högst upp på startsidan.
 *
 * Startsidan öppnade med en helskärmshög pitch. En besökare som kommit från en
 * story, en QR-kod i dörren eller bion på Instagram fick alltså skrolla förbi
 * en hel skärm innan något konkret dök upp, trots att frågan nästan alltid är
 * densamma: vad händer, och när?
 *
 * Här ligger svaret i stället. Samma kort som på /upplevelser, samma
 * filtrering — kommande plus det som saknar datum, utan klippkort — så att
 * sidan aldrig visar något annat än listan gör.
 *
 * Renderas inte alls när utbudet är tomt. En rubrik över ett tomrum är sämre
 * än ingen rubrik.
 */
export async function WhatsOn() {
  const t = await getTranslations("landing.whatsOn");
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select(
      "id, slug, title, price, event_date, event_location, event_city, event_venue, category, image_url, ticket_types(price)"
    )
    .eq("is_active", true)
    .eq("is_public", true)
    .or(BROWSABLE_TYPES)
    .or(upcomingOrUndated())
    // Närmast i tiden först; det som saknar datum hamnar sist, som i listan.
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(6);

  if (!listings || listings.length === 0) return null;

  const bookingCounts = await getBookingCounts(
    supabase,
    listings.map((l) => l.id)
  );

  return (
    <section className="relative px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t("heading")}</h2>
            <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("sub")}</p>
          </div>
          <Link
            href="/upplevelser"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--usha-gold)] transition hover:gap-2.5"
          >
            {t("seeAll")}
            <ArrowRight size={15} />
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => (
            <ListingCard key={l.id} listing={l} bookingCount={bookingCounts[l.id] ?? 0} />
          ))}
        </div>
      </div>
    </section>
  );
}
