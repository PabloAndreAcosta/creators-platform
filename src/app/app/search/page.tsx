import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import Link from "next/link";
import { BuyTicketCta } from "@/components/buy-ticket-cta";
import { MapPin, Search, Music } from "lucide-react";
import { getTranslations } from "next-intl/server";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; category?: string; subcategory?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const t = await getTranslations("searchPage");
  const query = params.q?.trim() ?? "";
  const categoryFilter = params.category ?? "";
  const subcategoryFilter = params.subcategory === "taxi_dancer" ? "taxi_dancer" : "";

  let creators: Array<{
    id: string;
    full_name: string | null;
    category: string | null;
    location: string | null;
    avatar_url: string | null;
  }> = [];

  let listings: Array<{
    id: string;
    title: string;
    category: string;
    price: number | null;
    user_id: string;
    profiles: { full_name: string | null } | null;
  }> = [];

  // Allow subcategory filter to drive results even without a search query
  const shouldSearch = query.length >= 2 || !!subcategoryFilter;

  if (shouldSearch) {
    const supabase = await createClient();
    const hasQuery = query.length >= 2;
    // Sanitize to prevent PostgREST filter injection
    const sanitized = hasQuery ? query.slice(0, 100).replace(/[,()\\%*_]/g, ' ').trim() : "";
    if (hasQuery && !sanitized) {
      return (
        <div className="px-4 py-6 md:max-w-3xl md:mx-auto">
          <h1 className="text-2xl font-bold mb-6">{t("title")}</h1>
          <p className="text-sm text-[var(--usha-muted)]">{t("noResults")}</p>
        </div>
      );
    }
    const pattern = sanitized ? `%${sanitized}%` : null;

    let creatorsQuery = supabase
      .from("profiles")
      .select("id, full_name, category, location, avatar_url")
      .eq("is_public", true);

    let listingsQuery = supabase
      .from("listings")
      .select("id, title, category, price, user_id, profiles(full_name)")
      .eq("is_active", true);

    if (pattern) {
      creatorsQuery = creatorsQuery.or(
        `full_name.ilike.${pattern},category.ilike.${pattern},location.ilike.${pattern},bio.ilike.${pattern}`
      );
      listingsQuery = listingsQuery.or(
        `title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},event_location.ilike.${pattern}`
      );
    }

    if (categoryFilter) {
      creatorsQuery = creatorsQuery.eq("category", categoryFilter);
      listingsQuery = listingsQuery.eq("category", categoryFilter);
    }

    if (subcategoryFilter === "taxi_dancer") {
      creatorsQuery = creatorsQuery.eq("creator_subcategory", "taxi_dancer");
      // For listings, restrict to those whose user has the taxi_dancer subcategory
      // by joining the profile with `profiles!inner` and filtering on the
      // related column.
      let scopedListingsQuery = supabase
        .from("listings")
        .select("id, title, category, price, user_id, profiles!inner(full_name, creator_subcategory)")
        .eq("is_active", true)
        .eq("profiles.creator_subcategory", "taxi_dancer");
      if (pattern) {
        scopedListingsQuery = scopedListingsQuery.or(
          `title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},event_location.ilike.${pattern}`
        );
      }
      if (categoryFilter) {
        scopedListingsQuery = scopedListingsQuery.eq("category", categoryFilter);
      }
      listingsQuery = scopedListingsQuery as unknown as typeof listingsQuery;
    }

    const [creatorsRes, listingsRes] = await Promise.all([
      creatorsQuery.order("full_name").limit(50),
      listingsQuery.order("created_at", { ascending: false }).limit(50),
    ]);

    creators = creatorsRes.data ?? [];
    listings = (listingsRes.data as unknown as typeof listings) ?? [];
  }

  const totalResults = creators.length + listings.length;

  return (
    <div className="px-4 py-6 md:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">
          {subcategoryFilter === "taxi_dancer" && !query
            ? t("taxiDancersTitle")
            : t("resultsTitle")}
        </h1>
        {query && (
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {subcategoryFilter === "taxi_dancer"
              ? t("resultsForAmongTaxiDancers", { count: totalResults, query })
              : t("resultsFor", { count: totalResults, query })}
          </p>
        )}
        {!query && subcategoryFilter === "taxi_dancer" && (
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {t("taxiDancersCount", { count: totalResults })}
          </p>
        )}
      </div>

      {/* Subcategory chips (taxi dancer toggle) */}
      <div className="mb-3 flex flex-wrap gap-2">
        <Link
          href={
            categoryFilter
              ? `/app/search?q=${encodeURIComponent(query)}&category=${categoryFilter}`
              : query
                ? `/app/search?q=${encodeURIComponent(query)}`
                : `/app/search`
          }
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !subcategoryFilter
              ? "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
              : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
          }`}
        >
          {t("allCreators")}
        </Link>
        <Link
          href={
            categoryFilter
              ? `/app/search?q=${encodeURIComponent(query)}&category=${categoryFilter}&subcategory=taxi_dancer`
              : query
                ? `/app/search?q=${encodeURIComponent(query)}&subcategory=taxi_dancer`
                : `/app/search?subcategory=taxi_dancer`
          }
          className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            subcategoryFilter === "taxi_dancer"
              ? "bg-[var(--usha-gold)] text-black"
              : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
          }`}
        >
          <Music size={12} />
          {t("taxiDancersChip")}
        </Link>
      </div>

      {/* Category filter chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={
            subcategoryFilter
              ? `/app/search?q=${encodeURIComponent(query)}&subcategory=${subcategoryFilter}`
              : `/app/search?q=${encodeURIComponent(query)}`
          }
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !categoryFilter
              ? "bg-[var(--usha-gold)] text-black"
              : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
          }`}
        >
          {t("allCategories")}
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.value}
            href={
              subcategoryFilter
                ? `/app/search?q=${encodeURIComponent(query)}&category=${cat.value}&subcategory=${subcategoryFilter}`
                : `/app/search?q=${encodeURIComponent(query)}&category=${cat.value}`
            }
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              categoryFilter === cat.value
                ? "bg-[var(--usha-gold)] text-black"
                : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Empty state – no query and no subcategory filter */}
      {!query && !subcategoryFilter && (
        <div className="py-12 text-center">
          <Search
            size={48}
            className="mx-auto mb-4 text-[var(--usha-muted)]"
          />
          <p className="text-sm text-[var(--usha-muted)]">
            {t("emptyPrompt")}
          </p>
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
              {t("popularCategories")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
                <Link
                  key={cat.value}
                  href={`/app/search?q=${cat.label.toLowerCase()}`}
                  className="rounded-full bg-[var(--usha-card)] px-4 py-2 text-sm text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card-hover)] hover:text-[var(--usha-white)]"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state – no results */}
      {shouldSearch && totalResults === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--usha-muted)]">
            {subcategoryFilter === "taxi_dancer" && !query
              ? t("noTaxiDancersYet")
              : t("noResultsFound", { query })}
          </p>
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
              {t("trySearchingFor")}
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
                <Link
                  key={cat.value}
                  href={`/app/search?q=${cat.label.toLowerCase()}`}
                  className="rounded-full bg-[var(--usha-card)] px-4 py-2 text-sm text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card-hover)] hover:text-[var(--usha-white)]"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Creators section */}
      {creators.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
            {t("creatorsHeading", { count: creators.length })}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {creators.map((c) => (
              <Link
                key={c.id}
                href={`/creators/${c.id}`}
                className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-colors hover:bg-[var(--usha-card-hover)]"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--usha-border)]">
                  <span className="text-sm font-bold text-[var(--usha-muted)]">
                    {(c.full_name || "?")[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {c.full_name || t("creatorFallback")}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-[var(--usha-muted)]">
                    {c.category && (
                      <span>{CATEGORY_LABELS[c.category] || c.category}</span>
                    )}
                    {c.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={10} />
                        {c.location}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Listings section */}
      {listings.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
            {t("listingsHeading", { count: listings.length })}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => {
              const creator = l.profiles as {
                full_name: string | null;
              } | null;
              return (
                <Link
                  key={l.id}
                  href={`/creators/${l.user_id}?listing=${l.id}`}
                  className="flex items-center justify-between rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition-colors hover:bg-[var(--usha-card-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{l.title}</p>
                    <p className="text-xs text-[var(--usha-muted)]">
                      {creator?.full_name || t("creatorFallback")} &middot;{" "}
                      {CATEGORY_LABELS[l.category] || l.category}
                    </p>
                  </div>
                  <BuyTicketCta
                    listingId={l.id}
                    price={l.price}
                    className="ml-3 flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2 text-xs font-semibold text-black transition hover:opacity-90"
                  />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
