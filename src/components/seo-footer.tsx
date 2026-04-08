import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { createClient } from "@/lib/supabase/server";

const FALLBACK_CITIES = [
  "Stockholm", "Göteborg", "Malmö", "Uppsala", "Linköping", "Örebro",
  "Västerås", "Helsingborg", "Norrköping", "Jönköping", "Umeå", "Lund",
];

export async function SeoFooter() {
  let cities: string[] = FALLBACK_CITIES;

  try {
    const supabase = await createClient();

    // Get top cities from active listings
    const { data: listingLocations } = await supabase
      .from("listings")
      .select("event_location")
      .eq("is_active", true)
      .not("event_location", "is", null);

    // Get top cities from public profiles
    const { data: profileLocations } = await supabase
      .from("profiles")
      .select("location")
      .eq("is_public", true)
      .not("location", "is", null);

    const cityCounts: Record<string, number> = {};
    [...(listingLocations || []), ...(profileLocations || [])].forEach((item) => {
      const loc = (item as any).event_location || (item as any).location;
      const city = loc?.split(",")[0]?.trim();
      if (city && city.length > 1) {
        cityCounts[city] = (cityCounts[city] || 0) + 1;
      }
    });

    const sorted = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([city]) => city);

    if (sorted.length >= 4) cities = sorted;
  } catch {}

  return (
    <footer className="border-t border-[var(--usha-border)] bg-[var(--usha-black)]">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-3">
          {/* Upplevelser per stad */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--usha-muted)]">
              Upplevelser
            </h3>
            <div className="flex flex-col gap-1.5">
              {cities.slice(0, 10).map((city) => (
                <Link
                  key={city}
                  href={`/upplevelser/${encodeURIComponent(city.toLowerCase())}`}
                  className="text-xs text-[var(--usha-muted)] transition hover:text-[var(--usha-gold)]"
                >
                  Upplevelser i {city}
                </Link>
              ))}
            </div>
          </div>

          {/* Kreatörer per stad */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--usha-muted)]">
              Kreatörer
            </h3>
            <div className="flex flex-col gap-1.5">
              {cities.slice(0, 10).map((city) => (
                <Link
                  key={city}
                  href={`/creators/stad/${encodeURIComponent(city.toLowerCase())}`}
                  className="text-xs text-[var(--usha-muted)] transition hover:text-[var(--usha-gold)]"
                >
                  Kreatörer i {city}
                </Link>
              ))}
            </div>
          </div>

          {/* Populära kategorier */}
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--usha-muted)]">
              Kategorier
            </h3>
            <div className="flex flex-col gap-1.5">
              {CATEGORIES.filter((c) => c.value !== "other").map((cat) => (
                <Link
                  key={cat.value}
                  href={`/upplevelser?category=${cat.value}`}
                  className="text-xs text-[var(--usha-muted)] transition hover:text-[var(--usha-gold)]"
                >
                  {cat.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Cross-links: city + category combos */}
        <div className="mt-8 border-t border-[var(--usha-border)] pt-6">
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {cities.slice(0, 6).flatMap((city) =>
              CATEGORIES.filter((c) => c.value !== "other")
                .slice(0, 4)
                .map((cat) => (
                  <Link
                    key={`${city}-${cat.value}`}
                    href={`/upplevelser/${encodeURIComponent(city.toLowerCase())}/${cat.value}`}
                    className="text-[10px] text-[var(--usha-muted)]/60 transition hover:text-[var(--usha-gold)]"
                  >
                    {cat.label} i {city}
                  </Link>
                ))
            )}
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--usha-border)] pt-6">
          <Link href="/" className="text-sm font-bold text-gradient">Usha</Link>
          <div className="flex gap-4">
            <Link href="/platser" className="text-[10px] text-[var(--usha-muted)] hover:text-white">Platser</Link>
            <Link href="/privacy" className="text-[10px] text-[var(--usha-muted)] hover:text-white">Integritetspolicy</Link>
            <Link href="/terms" className="text-[10px] text-[var(--usha-muted)] hover:text-white">Villkor</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
