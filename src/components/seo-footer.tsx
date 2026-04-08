import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";

const TOP_CITIES = [
  "Stockholm",
  "Göteborg",
  "Malmö",
  "Uppsala",
  "Linköping",
  "Örebro",
];

export function SeoFooter() {
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
              {TOP_CITIES.map((city) => (
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
              {TOP_CITIES.map((city) => (
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
            {TOP_CITIES.slice(0, 4).flatMap((city) =>
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
