export const dynamic = 'force-dynamic';

import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/categories";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { MapPin, Clock } from "lucide-react";

export const metadata: Metadata = {
  title: "Marketplace – Usha Platform",
  description:
    "Hitta och boka kreativa talanger. Dansinstruktörer, musiker, fotografer och mer.",
};

interface SearchParams {
  category?: string;
  q?: string;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { category, q } = searchParams;

  // Fetch public profiles
  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, avatar_url, bio, category, location, hourly_rate")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (category && category !== "all") {
    profilesQuery = profilesQuery.eq("category", category);
  }

  if (q) {
    profilesQuery = profilesQuery.or(
      `full_name.ilike.%${q}%,location.ilike.%${q}%,bio.ilike.%${q}%`
    );
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

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-[var(--usha-border)]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <span className="text-sm font-bold text-black">U</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Usha</span>
          </Link>
          <div className="flex items-center gap-3">
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
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Title + Search */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold">Marketplace</h1>
          <p className="text-[var(--usha-muted)]">
            Hitta kreativa talanger och boka deras tjänster.
          </p>
        </div>

        {/* Filters */}
        <form className="mb-8 flex flex-col gap-3 sm:flex-row">
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
        </form>

        {/* Results */}
        {!profiles || profiles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--usha-border)] py-20 text-center">
            <p className="text-[var(--usha-muted)]">
              {q || category
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
                    <div className="flex items-center gap-2 text-xs text-[var(--usha-muted)]">
                      {creator.category && (
                        <span>{CATEGORY_LABELS[creator.category] || creator.category}</span>
                      )}
                      {creator.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin size={10} />
                          {creator.location}
                        </span>
                      )}
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
                  {creator.hourly_rate != null ? (
                    <span className="font-semibold text-[var(--usha-gold)]">
                      {creator.hourly_rate} SEK/h
                    </span>
                  ) : (
                    <span />
                  )}
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
