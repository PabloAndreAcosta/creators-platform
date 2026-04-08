export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, SlidersHorizontal, X, Star, ShieldCheck, Sparkles } from "lucide-react";

export const metadata: Metadata = {
  title: "Marketplace – Usha Platform",
  description:
    "Hitta och boka kreativa talanger. Dansinstruktörer, musiker, fotografer och mer.",
};

interface SearchParams {
  category?: string;
  q?: string;
  location?: string;
  minPrice?: string;
  maxPrice?: string;
  sort?: string;
  page?: string;
}

const PAGE_SIZE = 20;

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  const { category, q, location, minPrice, maxPrice, sort, page: pageParam } = searchParams;
  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // Fetch public profiles
  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, bio, category, location, hourly_rate, categories, locations, rates, bankid_verified_at, created_at, slug", { count: "exact" })
    .eq("is_public", true);

  if (category && category !== "all") {
    profilesQuery = profilesQuery.or(`categories.cs.{${category}},category.eq.${category}`);
  }

  if (q) {
    const sanitized = q.replace(/[,()\\]/g, " ").trim();
    if (sanitized) {
      profilesQuery = profilesQuery.or(
        `full_name.ilike.%${sanitized}%,location.ilike.%${sanitized}%,bio.ilike.%${sanitized}%`
      );
    }
  }

  if (location) {
    const sanitizedLocation = location.replace(/[,()\\]/g, " ").trim();
    if (sanitizedLocation) {
      profilesQuery = profilesQuery.ilike("location", `%${sanitizedLocation}%`);
    }
  }

  if (minPrice) {
    const min = parseInt(minPrice, 10);
    if (Number.isFinite(min)) {
      profilesQuery = profilesQuery.gte("hourly_rate", min);
    }
  }

  if (maxPrice) {
    const max = parseInt(maxPrice, 10);
    if (Number.isFinite(max)) {
      profilesQuery = profilesQuery.lte("hourly_rate", max);
    }
  }

  // Sort
  switch (sort) {
    case "price_asc":
      profilesQuery = profilesQuery.order("hourly_rate", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      profilesQuery = profilesQuery.order("hourly_rate", { ascending: false, nullsFirst: false });
      break;
    case "name":
      profilesQuery = profilesQuery.order("full_name", { ascending: true });
      break;
    default:
      profilesQuery = profilesQuery.order("created_at", { ascending: false });
  }

  profilesQuery = profilesQuery.range(offset, offset + PAGE_SIZE - 1);

  const { data: profiles, count: totalCount } = await profilesQuery;
  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  // Fetch listing counts and follower counts per creator
  const creatorIds = profiles?.map((p) => p.id) ?? [];
  let listingCounts: Record<string, number> = {};
  let followerCounts: Record<string, number> = {};

  if (creatorIds.length > 0) {
    const [{ data: listings }, { data: follows }] = await Promise.all([
      supabase
        .from("listings")
        .select("user_id")
        .eq("is_active", true)
        .in("user_id", creatorIds),
      supabase
        .from("follows")
        .select("followed_id")
        .in("followed_id", creatorIds),
    ]);

    if (listings) {
      listingCounts = listings.reduce(
        (acc, l) => {
          acc[l.user_id] = (acc[l.user_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    }

    if (follows) {
      followerCounts = follows.reduce(
        (acc, f) => {
          acc[f.followed_id] = (acc[f.followed_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    }
  }

  // Fetch reviews (average rating + count per creator)
  let reviewData: Record<string, { avg: number; count: number }> = {};
  if (creatorIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("creator_id, rating")
      .in("creator_id", creatorIds);

    if (reviews) {
      const grouped: Record<string, number[]> = {};
      reviews.forEach((r) => {
        if (!grouped[r.creator_id]) grouped[r.creator_id] = [];
        grouped[r.creator_id].push(r.rating);
      });
      Object.entries(grouped).forEach(([id, ratings]) => {
        reviewData[id] = {
          avg: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
          count: ratings.length,
        };
      });
    }
  }

  // Fetch hero images (first listing image per creator)
  let heroImages: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: heroListings } = await supabase
      .from("listings")
      .select("user_id, image_url")
      .eq("is_active", true)
      .not("image_url", "is", null)
      .in("user_id", creatorIds)
      .order("created_at", { ascending: false });

    if (heroListings) {
      heroListings.forEach((l) => {
        if (!heroImages[l.user_id] && l.image_url) {
          heroImages[l.user_id] = l.image_url;
        }
      });
    }
  }

  // Post-query sort by rating or popularity (needs computed data)
  if (sort === "rating" && profiles) {
    profiles.sort((a, b) => {
      const rA = reviewData[a.id]?.avg || 0;
      const rB = reviewData[b.id]?.avg || 0;
      if (rB !== rA) return rB - rA;
      return (reviewData[b.id]?.count || 0) - (reviewData[a.id]?.count || 0);
    });
  } else if (sort === "popular" && profiles) {
    profiles.sort((a, b) => {
      const fA = followerCounts[a.id] || 0;
      const fB = followerCounts[b.id] || 0;
      if (fB !== fA) return fB - fA;
      return (listingCounts[b.id] || 0) - (listingCounts[a.id] || 0);
    });
  }

  // Get unique locations for the filter dropdown
  const { data: allLocations } = await supabase
    .from("profiles")
    .select("location")
    .eq("is_public", true)
    .not("location", "is", null);

  const uniqueLocations = Array.from(
    new Set((allLocations ?? []).map((p) => p.location).filter(Boolean) as string[])
  ).sort();

  // Active filter count (for badge)
  const activeFilters = [
    category && category !== "all",
    q,
    location,
    minPrice,
    maxPrice,
    sort && sort !== "newest",
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--usha-border)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
          <Link href={isLoggedIn ? "/app" : "/"} className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <span className="text-sm font-bold text-black">U</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Usha</span>
          </Link>
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <Link
                href="/app"
                className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
              >
                Appen
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="hidden text-sm text-[var(--usha-muted)] transition hover:text-white sm:block"
                >
                  Logga in
                </Link>
                <Link
                  href="/signup"
                  className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90"
                >
                  Kom igång
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-10">
        {/* Title */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Marketplace</h1>
          <p className="text-[var(--usha-muted)]">
            Hitta kreativa talanger och boka deras tjänster.
          </p>
        </div>

        {/* Filters */}
        <form className="mb-8 space-y-3">
          {/* Row 1: Search + Category + Submit */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              name="q"
              type="text"
              defaultValue={q || ""}
              placeholder="Sök namn, plats..."
              className="flex-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
            />
            <select
              name="category"
              defaultValue={category || "all"}
              className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40 sm:w-48"
            >
              <option value="all">Alla kategorier</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-xl bg-[var(--usha-card)] border border-[var(--usha-border)] px-6 py-3 text-sm font-medium transition-colors hover:border-[var(--usha-gold)]/40 hover:text-white"
            >
              Sök
            </button>
          </div>

          {/* Row 2: Location + Price range + Sort */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1.5 text-xs text-[var(--usha-muted)]">
              <SlidersHorizontal size={13} />
              <span>Filter:</span>
            </div>

            <select
              name="location"
              defaultValue={location || ""}
              className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs outline-none transition focus:border-[var(--usha-gold)]/40 sm:w-40"
            >
              <option value="">Alla platser</option>
              {uniqueLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <input
                name="minPrice"
                type="number"
                defaultValue={minPrice || ""}
                placeholder="Min pris"
                min={0}
                className="w-24 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs outline-none transition focus:border-[var(--usha-gold)]/40"
              />
              <span className="text-xs text-[var(--usha-muted)]">–</span>
              <input
                name="maxPrice"
                type="number"
                defaultValue={maxPrice || ""}
                placeholder="Max pris"
                min={0}
                className="w-24 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs outline-none transition focus:border-[var(--usha-gold)]/40"
              />
              <span className="text-xs text-[var(--usha-muted)]">SEK/h</span>
            </div>

            <select
              name="sort"
              defaultValue={sort || "newest"}
              className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-xs outline-none transition focus:border-[var(--usha-gold)]/40 sm:w-40"
            >
              <option value="newest">Nyast först</option>
              <option value="rating">Bäst betyg</option>
              <option value="popular">Mest populär</option>
              <option value="price_asc">Pris: Lägst först</option>
              <option value="price_desc">Pris: Högst först</option>
              <option value="name">Namn A–Ö</option>
            </select>

            {activeFilters > 0 && (
              <Link
                href="/marketplace"
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
              >
                <X size={12} />
                Rensa filter
              </Link>
            )}
          </div>
        </form>

        {/* Active filter tags */}
        {activeFilters > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {category && category !== "all" && (
              <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
                {CATEGORY_LABELS[category] || category}
              </span>
            )}
            {location && (
              <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
                {location}
              </span>
            )}
            {(minPrice || maxPrice) && (
              <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
                {minPrice || "0"} – {maxPrice || "∞"} SEK/h
              </span>
            )}
            <span className="text-xs text-[var(--usha-muted)] self-center">
              {profiles?.length ?? 0} resultat
            </span>
          </div>
        )}

        {/* Results */}
        {!profiles || profiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--usha-border)] py-20 text-center">
            <p className="text-[var(--usha-muted)]">
              {q || category || location || minPrice || maxPrice
                ? "Inga creators matchade din sökning."
                : "Inga creators finns ännu."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((creator) => {
              const cats = creator.categories?.length ? creator.categories : (creator.category ? [creator.category] : []);
              const locs = creator.locations?.length ? creator.locations : (creator.location ? [creator.location] : []);
              const review = reviewData[creator.id];
              const heroImg = heroImages[creator.id];
              const isVerified = !!(creator as any).bankid_verified_at;
              const isNew = creator.created_at && (Date.now() - new Date(creator.created_at).getTime()) < 14 * 24 * 60 * 60 * 1000;

              return (
                <Link
                  key={creator.id}
                  href={`/creators/${(creator as any).slug || creator.id}`}
                  className="group overflow-hidden rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition-all hover:border-[var(--usha-gold)]/20"
                >
                  {/* Hero image */}
                  <div className="relative aspect-[16/9] overflow-hidden bg-[var(--usha-gold)]/5">
                    {heroImg ? (
                      <img
                        src={heroImg}
                        alt=""
                        className="h-full w-full object-cover transition group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : creator.avatar_url ? (
                      <div className="flex h-full items-center justify-center">
                        <img
                          src={creator.avatar_url}
                          alt=""
                          className="h-20 w-20 rounded-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <span className="text-3xl font-bold text-[var(--usha-gold)]/20">
                          {creator.full_name?.[0]?.toUpperCase() || "U"}
                        </span>
                      </div>
                    )}

                    {/* Badges overlay */}
                    <div className="absolute left-2 top-2 flex gap-1">
                      {isVerified && (
                        <span className="flex items-center gap-0.5 rounded-full bg-blue-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                          <ShieldCheck size={8} /> Verifierad
                        </span>
                      )}
                      {isNew && (
                        <span className="flex items-center gap-0.5 rounded-full bg-green-500/90 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-sm">
                          <Sparkles size={8} /> Ny
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Name + avatar + categories */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--usha-border)]">
                        {creator.avatar_url ? (
                          <Image
                            src={creator.avatar_url}
                            alt={creator.full_name || "Creator"}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="text-sm font-bold text-[var(--usha-muted)]">
                            {creator.full_name?.[0]?.toUpperCase() || "?"}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold group-hover:text-[var(--usha-gold)]">
                          {creator.full_name || "Creator"}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--usha-muted)]">
                          {cats.slice(0, 2).map((cat: string) => (
                            <span key={cat} className="rounded-full bg-[var(--usha-gold)]/10 px-1.5 py-0.5 text-[var(--usha-gold)]">
                              {CATEGORY_LABELS[cat] || cat}
                            </span>
                          ))}
                          {locs.slice(0, 1).map((loc: string) => (
                            <span key={loc} className="flex items-center gap-0.5">
                              <MapPin size={8} /> {loc.split(",")[0]}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bio */}
                    {creator.bio && (
                      <p className="mt-2 line-clamp-2 text-xs text-[var(--usha-muted)]">
                        {creator.bio}
                      </p>
                    )}

                    {/* Footer: price + rating + stats */}
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const ratesObj = creator.rates && typeof creator.rates === "object" ? creator.rates as Record<string, number> : {};
                          const rateValues = Object.values(ratesObj).filter((v): v is number => typeof v === "number" && v > 0);
                          const minRate = rateValues.length ? Math.min(...rateValues) : creator.hourly_rate;
                          if (minRate != null) {
                            return <span className="font-semibold text-[var(--usha-gold)]">Från {minRate} kr</span>;
                          }
                          return null;
                        })()}
                        {review && (
                          <span className="flex items-center gap-0.5 text-[var(--usha-muted)]">
                            <Star size={10} className="fill-[var(--usha-gold)] text-[var(--usha-gold)]" />
                            {review.avg} ({review.count})
                          </span>
                        )}
                      </div>
                      <span className="flex items-center gap-2 text-[var(--usha-muted)]">
                        {followerCounts[creator.id] > 0 && (
                          <span>{followerCounts[creator.id]} följare</span>
                        )}
                        {listingCounts[creator.id] > 0 && (
                          <span>{listingCounts[creator.id]} tjänst{listingCounts[creator.id] > 1 ? "er" : ""}</span>
                        )}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-2">
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
              const params = new URLSearchParams();
              if (category) params.set("category", category);
              if (q) params.set("q", q);
              if (location) params.set("location", location);
              if (minPrice) params.set("minPrice", minPrice);
              if (maxPrice) params.set("maxPrice", maxPrice);
              if (sort) params.set("sort", sort);
              if (pageNum > 1) params.set("page", String(pageNum));
              const qs = params.toString();
              return (
                <Link
                  key={pageNum}
                  href={`/marketplace${qs ? `?${qs}` : ""}`}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition ${pageNum === currentPage ? "bg-[var(--usha-gold)]/15 font-semibold text-[var(--usha-gold)]" : "text-[var(--usha-muted)] hover:text-white"}`}
                >
                  {pageNum}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
