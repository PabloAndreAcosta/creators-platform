import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import Link from "next/link";
import { MapPin, Calendar, Search } from "lucide-react";
import { SeoFooter } from "@/components/seo-footer";

export const metadata: Metadata = {
  title: "Platser – Usha",
  description: "Utforska lokaler, studior, klubbar och platser där kreativa upplevelser händer.",
  openGraph: {
    title: "Platser – Usha",
    description: "Lokaler och platser för kreativa upplevelser.",
  },
};

interface SearchParams {
  q?: string;
}

export default async function PlatserPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { q } = searchParams;

  // Fetch venues
  let query = supabase
    .from("venues")
    .select("id, name, city, place_id, image_url")
    .order("name", { ascending: true });

  if (q) {
    const sanitized = q.replace(/[,()\\]/g, " ").trim();
    if (sanitized) {
      query = query.or(`name.ilike.%${sanitized}%,city.ilike.%${sanitized}%`);
    }
  }

  const { data: venues } = await query;

  // Count events per venue (via place_id match)
  const placeIds = (venues || []).map((v) => v.place_id).filter(Boolean);
  let eventCounts: Record<string, number> = {};

  if (placeIds.length > 0) {
    const { data: listings } = await supabase
      .from("listings")
      .select("event_place_id")
      .eq("is_active", true)
      .in("event_place_id", placeIds as string[]);

    if (listings) {
      listings.forEach((l) => {
        if (l.event_place_id) {
          eventCounts[l.event_place_id] = (eventCounts[l.event_place_id] || 0) + 1;
        }
      });
    }
  }

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <header className="sticky top-0 z-30 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold text-gradient">Usha</Link>
          <nav className="flex items-center gap-4">
            <Link href="/flode" className="text-sm text-[var(--usha-muted)] hover:text-white">Flöde</Link>
            <Link href="/upplevelser" className="text-sm text-[var(--usha-muted)] hover:text-white">Upplevelser</Link>
            <Link href="/marketplace" className="text-sm text-[var(--usha-muted)] hover:text-white">Marketplace</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold md:text-3xl">Platser</h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          Lokaler, studior och platser där upplevelser händer
        </p>

        {/* Search */}
        <form className="mt-6">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--usha-muted)]" />
            <input
              name="q"
              type="text"
              defaultValue={q || ""}
              placeholder="Sök plats eller stad..."
              className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-[var(--usha-gold)]/40 sm:max-w-md"
            />
          </div>
        </form>

        {/* Venues grid */}
        {venues && venues.length > 0 ? (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => {
              const count = venue.place_id ? eventCounts[venue.place_id] || 0 : 0;
              return (
                <Link
                  key={venue.id}
                  href={`/platser/${venue.id}`}
                  className="group overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition hover:border-[var(--usha-gold)]/30"
                >
                  <div className="flex aspect-[2/1] items-center justify-center bg-[var(--usha-gold)]/5">
                    {venue.image_url ? (
                      <img src={venue.image_url} alt={venue.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <MapPin size={28} className="text-[var(--usha-gold)]/20" />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-semibold">{venue.name}</p>
                    {venue.city && (
                      <p className="mt-0.5 flex items-center gap-0.5 text-xs text-[var(--usha-muted)]">
                        <MapPin size={10} /> {venue.city}
                      </p>
                    )}
                    {count > 0 && (
                      <p className="mt-1 flex items-center gap-0.5 text-xs text-[var(--usha-gold)]">
                        <Calendar size={10} /> {count} upplevelse{count > 1 ? "r" : ""}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mt-12 text-center">
            <p className="text-sm text-[var(--usha-muted)]">
              {q ? "Inga platser hittade." : "Inga platser ännu."}
            </p>
          </div>
        )}
      </main>

      <SeoFooter />
    </div>
  );
}
