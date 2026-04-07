import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Calendar, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Upplevelser – Usha",
  description:
    "Utforska kreativa upplevelser, events och tjänster nära dig. Dans, musik, fotografi och mer.",
  openGraph: {
    title: "Upplevelser – Usha",
    description:
      "Utforska kreativa upplevelser, events och tjänster nära dig.",
  },
};

export default async function UpplevelserPage() {
  const supabase = await createClient();

  // Get unique locations from active listings
  const { data: locationData } = await supabase
    .from("listings")
    .select("event_location")
    .eq("is_active", true)
    .not("event_location", "is", null);

  const locationCounts: Record<string, number> = {};
  (locationData || []).forEach((l) => {
    const loc = l.event_location?.trim();
    if (loc) {
      // Extract city name (first part before comma)
      const city = loc.split(",")[0].trim();
      locationCounts[city] = (locationCounts[city] || 0) + 1;
    }
  });

  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // Get category counts
  const { data: categoryData } = await supabase
    .from("listings")
    .select("category")
    .eq("is_active", true);

  const categoryCounts: Record<string, number> = {};
  (categoryData || []).forEach((l) => {
    if (l.category) {
      categoryCounts[l.category] = (categoryCounts[l.category] || 0) + 1;
    }
  });

  // Get latest listings for preview
  const { data: latestListings } = await supabase
    .from("listings")
    .select("id, title, price, event_date, event_location, category, image_url")
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(12);

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <header className="sticky top-0 z-30 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-gradient">
            Usha
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/flode" className="text-sm text-[var(--usha-muted)] hover:text-white">
              Flöde
            </Link>
            <Link href="/marketplace" className="text-sm text-[var(--usha-muted)] hover:text-white">
              Marketplace
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-1.5 text-xs font-bold text-black"
            >
              Skapa konto
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold md:text-3xl">Upplevelser</h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          Utforska kreativa events, tjänster och upplevelser i hela Sverige
        </p>

        {/* Categories */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Kategorier</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
              <Link
                key={cat.value}
                href={`/marketplace?category=${cat.value}`}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-2 text-sm transition hover:border-[var(--usha-gold)]/30 hover:text-white"
              >
                {cat.label}
                {categoryCounts[cat.value] ? (
                  <span className="text-xs text-[var(--usha-muted)]">
                    ({categoryCounts[cat.value]})
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        </section>

        {/* Locations */}
        {topLocations.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Populära städer</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {topLocations.map(([city, count]) => (
                <Link
                  key={city}
                  href={`/upplevelser/${encodeURIComponent(city.toLowerCase())}`}
                  className="flex items-center justify-between rounded-lg border border-[var(--usha-border)] px-3 py-2.5 text-sm transition hover:border-[var(--usha-gold)]/30 hover:text-white"
                >
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-[var(--usha-gold)]" />
                    {city}
                  </span>
                  <span className="text-xs text-[var(--usha-muted)]">{count}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Latest listings */}
        {latestListings && latestListings.length > 0 && (
          <section className="mt-8">
            <h2 className="text-lg font-semibold">Senaste upplevelser</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {latestListings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/listing/${listing.id}`}
                  className="group overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition hover:border-[var(--usha-gold)]/30"
                >
                  {listing.image_url ? (
                    <div className="aspect-video overflow-hidden">
                      <img
                        src={listing.image_url}
                        alt={listing.title}
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-[var(--usha-gold)]/5">
                      <Calendar size={24} className="text-[var(--usha-gold)]/30" />
                    </div>
                  )}
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold">{listing.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--usha-muted)]">
                      {listing.event_date && (
                        <span className="flex items-center gap-0.5">
                          <Calendar size={10} />
                          {new Date(listing.event_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                        </span>
                      )}
                      {listing.event_location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin size={10} />
                          {listing.event_location.split(",")[0]}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-[var(--usha-gold)]">
                        {listing.price ? `${listing.price} kr` : "Gratis"}
                      </span>
                      {listing.category && (
                        <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] text-[var(--usha-gold)]">
                          {CATEGORY_LABELS[listing.category] || listing.category}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* City + Category grid for SEO */}
        {topLocations.length > 0 && (
          <section className="mt-12 border-t border-[var(--usha-border)] pt-8">
            <h2 className="text-lg font-semibold">Utforska per stad och kategori</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {topLocations.slice(0, 6).map(([city]) => (
                <div key={city}>
                  <h3 className="mb-2 text-sm font-semibold">{city}</h3>
                  <div className="flex flex-col gap-1">
                    {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
                      <Link
                        key={`${city}-${cat.value}`}
                        href={`/upplevelser/${encodeURIComponent(city.toLowerCase())}/${cat.value}`}
                        className="flex items-center gap-1 text-xs text-[var(--usha-muted)] transition hover:text-[var(--usha-gold)]"
                      >
                        <ArrowRight size={10} />
                        {cat.label} i {city}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
