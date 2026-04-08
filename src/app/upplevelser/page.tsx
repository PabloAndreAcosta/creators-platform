import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Calendar, ArrowRight, SlidersHorizontal } from "lucide-react";
import { SeoFooter } from "@/components/seo-footer";
import { ListingCard } from "@/components/listing-card";
import { getBookingCounts, sortWithPromoted, isActivelyPromoted } from "@/lib/listings/popularity";
import { GeoLocationDetector } from "@/components/geo-location";
import { EventCarousel } from "@/components/event-carousel";

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

interface SearchParams {
  category?: string;
  location?: string;
  sort?: string;
  page?: string;
}

const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "date", label: "Datum" },
  { value: "price_asc", label: "Pris (lägst)" },
  { value: "price_desc", label: "Pris (högst)" },
  { value: "newest", label: "Nyast" },
] as const;

export default async function UpplevelserPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { category, location, sort, page: pageParam } = searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // ── Build filtered listings query ──
  let query = supabase
    .from("listings")
    .select("id, title, price, event_date, event_location, category, image_url, listing_type, created_at, is_promoted, promoted_until", { count: "exact" })
    .eq("is_active", true);

  if (category && category !== "all") {
    query = query.eq("category", category);
  }

  if (location) {
    const sanitized = decodeURIComponent(location).replace(/[,()\\]/g, " ").trim();
    if (sanitized) {
      query = query.ilike("event_location", `%${sanitized}%`);
    }
  }

  // Sort
  switch (sort) {
    case "date":
      query = query.order("event_date", { ascending: true, nullsFirst: false });
      break;
    case "price_asc":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  // Paginate
  query = query.range(offset, offset + PAGE_SIZE - 1);

  const { data: rawListings, count: totalCount } = await query;
  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  // Fetch booking counts for badges
  const listingIds = (rawListings || []).map((l) => l.id);
  const bookingCounts = await getBookingCounts(supabase, listingIds);

  // Sort promoted first (preserve sort order otherwise)
  const listings = sortWithPromoted(rawListings || []);

  // ── Fetch promoted events for carousel ──
  const { data: promotedEvents } = await supabase
    .from("listings")
    .select("id, slug, title, price, event_date, event_location, image_url, category, is_promoted, promoted_until")
    .eq("is_active", true)
    .eq("is_promoted", true)
    .order("created_at", { ascending: false })
    .limit(6);

  const activePromoted = (promotedEvents || []).filter(
    (e) => !e.promoted_until || new Date(e.promoted_until) > new Date()
  );

  // ── Get unique locations for filter ──
  const { data: locationData } = await supabase
    .from("listings")
    .select("event_location")
    .eq("is_active", true)
    .not("event_location", "is", null);

  const locationCounts: Record<string, number> = {};
  (locationData || []).forEach((l) => {
    const loc = l.event_location?.trim();
    if (loc) {
      const city = loc.split(",")[0].trim();
      locationCounts[city] = (locationCounts[city] || 0) + 1;
    }
  });
  const topLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20);

  // ── Get category counts ──
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

  // ── Helper to build filter URLs ──
  function filterUrl(overrides: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = { category, location, sort, ...overrides };
    Object.entries(merged).forEach(([k, v]) => {
      if (v && v !== "all") params.set(k, v);
    });
    const qs = params.toString();
    return `/upplevelser${qs ? `?${qs}` : ""}`;
  }

  const hasFilters = category || location || sort;

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <header className="sticky top-0 z-30 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-gradient">Usha</Link>
          <nav className="flex items-center gap-4">
            <Link href="/flode" className="text-sm text-[var(--usha-muted)] hover:text-white">Flöde</Link>
            <Link href="/marketplace" className="text-sm text-[var(--usha-muted)] hover:text-white">Marketplace</Link>
            <Link href="/signup" className="rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--usha-muted)] hover:text-white">Skapa profil</Link>
          </nav>
        </div>
      </header>

      <GeoLocationDetector basePath="/upplevelser" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Featured carousel */}
        {activePromoted.length > 0 && (
          <EventCarousel events={activePromoted} />
        )}

        <h1 className="text-2xl font-bold md:text-3xl">Upplevelser</h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          {totalCount || 0} upplevelser i hela Sverige
        </p>

        {/* ── Filter bar ── */}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <SlidersHorizontal size={14} className="text-[var(--usha-muted)]" />

          {/* Category filter */}
          <Link
            href={filterUrl({ category: undefined, page: undefined })}
            className={`rounded-lg px-3 py-1.5 text-xs transition ${!category ? "bg-[var(--usha-gold)]/15 font-semibold text-[var(--usha-gold)]" : "border border-[var(--usha-border)] text-[var(--usha-muted)] hover:border-[var(--usha-gold)]/30 hover:text-white"}`}
          >
            Alla
          </Link>
          {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
            <Link
              key={cat.value}
              href={filterUrl({ category: cat.value, page: undefined })}
              className={`rounded-lg px-3 py-1.5 text-xs transition ${category === cat.value ? "bg-[var(--usha-gold)]/15 font-semibold text-[var(--usha-gold)]" : "border border-[var(--usha-border)] text-[var(--usha-muted)] hover:border-[var(--usha-gold)]/30 hover:text-white"}`}
            >
              {cat.label}
              {categoryCounts[cat.value] ? ` (${categoryCounts[cat.value]})` : ""}
            </Link>
          ))}
        </div>

        {/* Location + sort row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {/* Location pills */}
          {topLocations.length > 0 && (
            <>
              <Link
                href={filterUrl({ location: undefined, page: undefined })}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition ${!location ? "bg-[var(--usha-gold)]/15 font-semibold text-[var(--usha-gold)]" : "border border-[var(--usha-border)] text-[var(--usha-muted)] hover:border-[var(--usha-gold)]/30 hover:text-white"}`}
              >
                <MapPin size={10} /> Alla städer
              </Link>
              {topLocations.slice(0, 8).map(([city]) => (
                <Link
                  key={city}
                  href={filterUrl({ location: city.toLowerCase(), page: undefined })}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition ${location?.toLowerCase() === city.toLowerCase() ? "bg-[var(--usha-gold)]/15 font-semibold text-[var(--usha-gold)]" : "border border-[var(--usha-border)] text-[var(--usha-muted)] hover:border-[var(--usha-gold)]/30 hover:text-white"}`}
                >
                  {city}
                </Link>
              ))}
            </>
          )}

          {/* Sort - pushed right */}
          <div className="ml-auto flex items-center gap-1.5">
            {SORT_OPTIONS.map((opt) => (
              <Link
                key={opt.value}
                href={filterUrl({ sort: opt.value, page: undefined })}
                className={`rounded-lg px-2.5 py-1.5 text-xs transition ${(sort || "newest") === opt.value ? "bg-white/10 font-medium text-white" : "text-[var(--usha-muted)] hover:text-white"}`}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <div className="mt-3">
            <Link href="/upplevelser" className="text-xs text-[var(--usha-muted)] hover:text-[var(--usha-gold)]">
              Rensa filter
            </Link>
          </div>
        )}

        {/* ── Listings grid ── */}
        {listings && listings.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
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
            <p className="text-sm text-[var(--usha-muted)]">Inga upplevelser hittade med dessa filter.</p>
            {hasFilters && (
              <Link href="/upplevelser" className="mt-2 inline-block text-sm text-[var(--usha-gold)] hover:underline">
                Rensa filter
              </Link>
            )}
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
            {currentPage > 1 && (
              <Link
                href={filterUrl({ page: String(currentPage - 1) })}
                className="rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white"
              >
                Föregående
              </Link>
            )}
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }
              return (
                <Link
                  key={pageNum}
                  href={filterUrl({ page: String(pageNum) })}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition ${pageNum === currentPage ? "bg-[var(--usha-gold)]/15 font-semibold text-[var(--usha-gold)]" : "text-[var(--usha-muted)] hover:text-white"}`}
                >
                  {pageNum}
                </Link>
              );
            })}
            {currentPage < totalPages && (
              <Link
                href={filterUrl({ page: String(currentPage + 1) })}
                className="rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white"
              >
                Nästa
              </Link>
            )}
          </div>
        )}

        {/* ── SEO: City + Category grid ── */}
        {topLocations.length > 0 && !hasFilters && (
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

      <SeoFooter />
    </div>
  );
}
