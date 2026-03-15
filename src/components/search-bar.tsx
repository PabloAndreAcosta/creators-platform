"use client";

import { useState, useEffect, useRef } from "react";
import { Search, X, MapPin } from "lucide-react";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/lib/categories";

interface SearchListing {
  id: string;
  title: string;
  category: string;
  price: number | null;
  user_id: string;
  profiles: { full_name: string | null } | null;
}

interface SearchCreator {
  id: string;
  full_name: string | null;
  category: string | null;
  location: string | null;
  avatar_url: string | null;
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [listings, setListings] = useState<SearchListing[]>([]);
  const [creators, setCreators] = useState<SearchCreator[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (query.length < 2) {
      setListings([]);
      setCreators([]);
      setOpen(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setListings(data.listings ?? []);
        setCreators(data.creators ?? []);
        setOpen(true);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const hasResults = listings.length > 0 || creators.length > 0;

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--usha-muted)]"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Sök evenemang, kreatörer, platser..."
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] pl-10 pr-10 py-3 text-sm text-white placeholder:text-[var(--usha-muted)] focus:border-[var(--usha-gold)]/50 focus:outline-none"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setOpen(false); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--usha-muted)] hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] shadow-2xl">
          {loading && (
            <div className="px-4 py-3 text-center text-xs text-[var(--usha-muted)]">
              Söker...
            </div>
          )}

          {!loading && !hasResults && query.length >= 2 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--usha-muted)]">
              Inga resultat för &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Creators */}
          {creators.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
                Kreatörer
              </p>
              {creators.map((c) => (
                <Link
                  key={c.id}
                  href={`/creators/${c.id}`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--usha-card-hover)]"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--usha-border)]">
                    <span className="text-xs font-bold text-[var(--usha-muted)]">
                      {(c.full_name || "?")[0]?.toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {c.full_name || "Kreatör"}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--usha-muted)]">
                      {c.category && <span>{CATEGORY_LABELS[c.category] || c.category}</span>}
                      {c.location && (
                        <span className="flex items-center gap-0.5">
                          <MapPin size={9} />
                          {c.location}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Listings */}
          {listings.length > 0 && (
            <div>
              <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
                Evenemang & Tjänster
              </p>
              {listings.map((l) => {
                const creator = l.profiles as { full_name: string | null } | null;
                return (
                  <Link
                    key={l.id}
                    href={`/creators/${l.user_id}?listing=${l.id}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[var(--usha-card-hover)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.title}</p>
                      <p className="text-[11px] text-[var(--usha-muted)]">
                        {creator?.full_name || "Kreatör"} · {CATEGORY_LABELS[l.category] || l.category}
                      </p>
                    </div>
                    {l.price != null && (
                      <span className="ml-3 shrink-0 text-xs font-semibold text-[var(--usha-gold)]">
                        {l.price} kr
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}

          {/* Link to marketplace */}
          {hasResults && (
            <Link
              href={`/marketplace?q=${encodeURIComponent(query)}`}
              onClick={() => setOpen(false)}
              className="block border-t border-[var(--usha-border)] px-4 py-3 text-center text-xs font-medium text-[var(--usha-gold)] transition-colors hover:bg-[var(--usha-card-hover)]"
            >
              Visa alla resultat i Marketplace
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
