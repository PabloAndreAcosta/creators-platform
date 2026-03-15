import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import Link from "next/link";
import { MapPin, Search } from "lucide-react";

interface SearchPageProps {
  searchParams: Promise<{ q?: string; category?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const categoryFilter = params.category ?? "";

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

  if (query.length >= 2) {
    const supabase = await createClient();
    const pattern = `%${query}%`;

    let creatorsQuery = supabase
      .from("profiles")
      .select("id, full_name, category, location, avatar_url")
      .eq("is_public", true)
      .or(
        `full_name.ilike.${pattern},category.ilike.${pattern},location.ilike.${pattern},bio.ilike.${pattern}`
      );

    let listingsQuery = supabase
      .from("listings")
      .select("id, title, category, price, user_id, profiles(full_name)")
      .eq("is_active", true)
      .or(
        `title.ilike.${pattern},description.ilike.${pattern},category.ilike.${pattern},event_location.ilike.${pattern}`
      );

    if (categoryFilter) {
      creatorsQuery = creatorsQuery.eq("category", categoryFilter);
      listingsQuery = listingsQuery.eq("category", categoryFilter);
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
        <h1 className="text-xl font-bold">Sökresultat</h1>
        {query && (
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {totalResults} resultat för &ldquo;{query}&rdquo;
          </p>
        )}
      </div>

      {/* Category filter chips */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href={`/app/search?q=${encodeURIComponent(query)}`}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            !categoryFilter
              ? "bg-[var(--usha-gold)] text-black"
              : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-white"
          }`}
        >
          Alla
        </Link>
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.value}
            href={`/app/search?q=${encodeURIComponent(query)}&category=${cat.value}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              categoryFilter === cat.value
                ? "bg-[var(--usha-gold)] text-black"
                : "bg-[var(--usha-card)] text-[var(--usha-muted)] hover:text-white"
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Empty state – no query */}
      {!query && (
        <div className="py-12 text-center">
          <Search
            size={48}
            className="mx-auto mb-4 text-[var(--usha-muted)]"
          />
          <p className="text-sm text-[var(--usha-muted)]">
            Använd sökfältet ovan för att hitta kreatörer och evenemang
          </p>
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
              Populära kategorier
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
                <Link
                  key={cat.value}
                  href={`/app/search?q=${cat.label.toLowerCase()}`}
                  className="rounded-full bg-[var(--usha-card)] px-4 py-2 text-sm text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card-hover)] hover:text-white"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state – no results */}
      {query && totalResults === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-[var(--usha-muted)]">
            Inga resultat hittades för &ldquo;{query}&rdquo;
          </p>
          <div className="mt-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
              Prova att söka på
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
                <Link
                  key={cat.value}
                  href={`/app/search?q=${cat.label.toLowerCase()}`}
                  className="rounded-full bg-[var(--usha-card)] px-4 py-2 text-sm text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card-hover)] hover:text-white"
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
            Kreatörer ({creators.length})
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
                    {c.full_name || "Kreatör"}
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
            Evenemang & Tjänster ({listings.length})
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
                      {creator?.full_name || "Kreatör"} &middot;{" "}
                      {CATEGORY_LABELS[l.category] || l.category}
                    </p>
                  </div>
                  {l.price != null && (
                    <span className="ml-3 shrink-0 text-sm font-semibold text-[var(--usha-gold)]">
                      {l.price} kr
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
