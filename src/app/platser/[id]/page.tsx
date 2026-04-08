import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, ArrowLeft } from "lucide-react";
import { SeoFooter } from "@/components/seo-footer";
import { ListingCard } from "@/components/listing-card";
import { getBookingCounts, sortWithPromoted, isActivelyPromoted } from "@/lib/listings/popularity";

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient();
  const { data: venue } = await supabase
    .from("venues")
    .select("name, city")
    .eq("id", params.id)
    .single();

  if (!venue) return { title: "Plats – Usha" };

  return {
    title: `${venue.name} – Usha`,
    description: `Upplevelser och events på ${venue.name}${venue.city ? ` i ${venue.city}` : ""}.`,
    openGraph: {
      title: `${venue.name} – Usha`,
      description: `Se vad som händer på ${venue.name}.`,
    },
  };
}

export default async function VenueDetailPage({ params }: Props) {
  const supabase = await createClient();

  const { data: venue } = await supabase
    .from("venues")
    .select("id, name, address, city, place_id, lat, lng, image_url")
    .eq("id", params.id)
    .single();

  if (!venue) notFound();

  // Fetch listings at this venue
  let listings: any[] = [];
  if (venue.place_id) {
    const { data } = await supabase
      .from("listings")
      .select("id, title, price, event_date, event_location, category, image_url, listing_type, is_promoted, promoted_until, slug")
      .eq("is_active", true)
      .eq("event_place_id", venue.place_id)
      .order("event_date", { ascending: true, nullsFirst: false });

    listings = data || [];
  }

  const listingIds = listings.map((l) => l.id);
  const bookingCounts = await getBookingCounts(supabase, listingIds);
  const sortedListings = sortWithPromoted(listings);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: venue.name,
    url: `https://usha.se/platser/${venue.id}`,
    ...(venue.address ? { address: venue.address } : {}),
    ...(venue.lat && venue.lng ? {
      geo: { "@type": "GeoCoordinates", latitude: venue.lat, longitude: venue.lng },
    } : {}),
  };

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="sticky top-0 z-30 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-gradient">Usha</Link>
          <nav className="flex items-center gap-4">
            <Link href="/platser" className="text-sm text-[var(--usha-muted)] hover:text-white">Platser</Link>
            <Link href="/upplevelser" className="text-sm text-[var(--usha-muted)] hover:text-white">Upplevelser</Link>
            <Link href="/marketplace" className="text-sm text-[var(--usha-muted)] hover:text-white">Marketplace</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Link href="/platser" className="mb-4 flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-white">
          <ArrowLeft size={14} /> Alla platser
        </Link>

        {/* Venue header */}
        {venue.image_url && (
          <div className="mb-6 overflow-hidden rounded-xl">
            <img src={venue.image_url} alt={venue.name} className="h-48 w-full object-cover md:h-64" />
          </div>
        )}

        <h1 className="text-2xl font-bold md:text-3xl">{venue.name}</h1>
        {venue.city && (
          <p className="mt-1 flex items-center gap-1 text-sm text-[var(--usha-muted)]">
            <MapPin size={14} /> {venue.address || venue.city}
          </p>
        )}
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          {sortedListings.length} upplevelse{sortedListings.length !== 1 ? "r" : ""} på denna plats
        </p>

        {/* Listings */}
        {sortedListings.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sortedListings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                bookingCount={bookingCounts[listing.id] || 0}
                isPromoted={isActivelyPromoted(listing)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-12 text-center">
            <p className="text-sm text-[var(--usha-muted)]">Inga upplevelser på denna plats just nu.</p>
            <Link href="/upplevelser" className="mt-2 inline-block text-sm text-[var(--usha-gold)] hover:underline">
              Se alla upplevelser
            </Link>
          </div>
        )}
      </main>

      <SeoFooter />
    </div>
  );
}
