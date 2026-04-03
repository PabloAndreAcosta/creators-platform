export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock, SlidersHorizontal, X } from "lucide-react";

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
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;
  const { category, q, location, minPrice, maxPrice, sort } = searchParams;

  // Fetch public profiles
  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, bio, category, location, hourly_rate, categories, locations, rates")
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

  const { data: profiles } = await profilesQuery;

  // Fetch listing counts per creator
  const creatorIds = profiles?.map((p) => p.id) ?? [];
  let listingCounts: Record<string, number> = {};

  if (creatorIds.length > 0) {
    const { data: listings } = await supabase
      .from("listings")
      .select("user_id")
      .eq("is_active", true)
      .in("user_id", creatorIds);

    if (listings) {
      listingCounts = listings.reduce(
        (acc, l) => {
          acc[l.user_id] = (acc[l.user_id] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );
    }
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
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
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

      <div className="mx-auto max-w-6xl px-6 py-10">
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
            {profiles.map((creator) => (
              <Link
                key={creator.id}
                href={`/creators/${creator.id}`}
                className="group rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-all hover:border-[var(--usha-gold)]/20 hover:bg-[var(--usha-card-hover)]"
              >
                {/* Avatar + Name */}
                <div className="mb-4 flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--usha-border)] bg-[var(--usha-black)]">
                    {creator.avatar_url ? (
                      <Image
                        src={creator.avatar_url}
                        alt={creator.full_name || "Creator"}
                        width={56}
                        height={56}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-lg font-bold text-[var(--usha-muted)]">
                        {creator.full_name?.[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold group-hover:text-[var(--usha-gold)]">
                      {creator.full_name || "Creator"}
                    </h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--usha-muted)]">
                      {(creator.categories?.length ? creator.categories : (creator.category ? [creator.category] : [])).map((cat: string) => (
                        <span key={cat}>{CATEGORY_LABELS[cat] || cat}</span>
                      ))}
                      {(creator.locations?.length ? creator.locations : (creator.location ? [creator.location] : [])).slice(0, 2).map((loc: string) => (
                        <span key={loc} className="flex items-center gap-0.5">
                          <MapPin size={10} />
                          {loc}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bio */}
                {creator.bio && (
                  <p className="mb-4 line-clamp-2 text-sm text-[var(--usha-muted)]">
                    {creator.bio}
                  </p>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between text-sm">
                  {(() => {
                    const ratesObj = creator.rates && typeof creator.rates === "object" ? creator.rates as Record<string, number> : {};
                    const rateValues = Object.values(ratesObj).filter((v): v is number => typeof v === "number" && v > 0);
                    const minRate = rateValues.length ? Math.min(...rateValues) : creator.hourly_rate;
                    const maxRate = rateValues.length ? Math.max(...rateValues) : null;
                    if (minRate != null) {
                      return (
                        <span className="font-semibold text-[var(--usha-gold)]">
                          {minRate === maxRate || !maxRate ? `${minRate} SEK/h` : `${minRate}–${maxRate} SEK/h`}
                        </span>
                      );
                    }
                    return <span />;
                  })()}
                  {listingCounts[creator.id] > 0 && (
                    <span className="flex items-center gap-1 text-xs text-[var(--usha-muted)]">
                      <Clock size={10} />
                      {listingCounts[creator.id]} tjänst{listingCounts[creator.id] > 1 ? "er" : ""}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
