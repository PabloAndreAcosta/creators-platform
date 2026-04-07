import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Calendar, ArrowLeft } from "lucide-react";

interface Props {
  params: { location: string; category: string };
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const city = capitalize(decodeURIComponent(params.location));
  const categoryLabel = CATEGORY_LABELS[params.category] || capitalize(params.category);

  return {
    title: `${categoryLabel} i ${city} – Usha`,
    description: `Hitta ${categoryLabel.toLowerCase()} events och upplevelser i ${city}. Boka direkt på Usha.`,
    openGraph: {
      title: `${categoryLabel} i ${city} – Usha`,
      description: `${categoryLabel} events och upplevelser i ${city}.`,
    },
  };
}

export default async function LocationCategoryPage({ params }: Props) {
  const city = capitalize(decodeURIComponent(params.location));
  const categoryLabel = CATEGORY_LABELS[params.category] || capitalize(params.category);
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, title, description, price, event_date, event_location, category, image_url, listing_type")
    .eq("is_active", true)
    .eq("category", params.category)
    .ilike("event_location", `%${city}%`)
    .order("event_date", { ascending: true, nullsFirst: false })
    .limit(50);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${categoryLabel} i ${city}`,
    description: `${categoryLabel} events och upplevelser i ${city}`,
    url: `https://usha.se/upplevelser/${encodeURIComponent(city.toLowerCase())}/${params.category}`,
  };

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="sticky top-0 z-30 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-gradient">Usha</Link>
          <nav className="flex items-center gap-4">
            <Link href="/flode" className="text-sm text-[var(--usha-muted)] hover:text-white">Flöde</Link>
            <Link href="/upplevelser" className="text-sm text-[var(--usha-muted)] hover:text-white">Upplevelser</Link>
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
        <Link
          href={`/upplevelser/${encodeURIComponent(city.toLowerCase())}`}
          className="mb-4 flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-white"
        >
          <ArrowLeft size={14} /> Alla i {city}
        </Link>

        <h1 className="text-2xl font-bold md:text-3xl">{categoryLabel} i {city}</h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          {listings?.length || 0} upplevelser hittade
        </p>

        {/* Other categories in this city */}
        <div className="mt-4 flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.value !== "other" && c.value !== params.category).map((cat) => (
            <Link
              key={cat.value}
              href={`/upplevelser/${encodeURIComponent(city.toLowerCase())}/${cat.value}`}
              className="rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs transition hover:border-[var(--usha-gold)]/30 hover:text-white"
            >
              {cat.label}
            </Link>
          ))}
        </div>

        {/* Listings grid */}
        {listings && listings.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
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
                  <div className="mt-2">
                    <span className="text-xs font-medium text-[var(--usha-gold)]">
                      {listing.price ? `${listing.price} kr` : "Gratis"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-12 text-center">
            <p className="text-sm text-[var(--usha-muted)]">
              Inga {categoryLabel.toLowerCase()} upplevelser i {city} just nu.
            </p>
            <Link
              href={`/upplevelser/${encodeURIComponent(city.toLowerCase())}`}
              className="mt-2 inline-block text-sm text-[var(--usha-gold)] hover:underline"
            >
              Se alla upplevelser i {city}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
