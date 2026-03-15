"use client";

import { useState, useEffect } from "react";
import { Heart, Loader2, MapPin } from "lucide-react";
import Link from "next/link";

interface FavoriteListing {
  id: string;
  title: string;
  category: string;
  price: number | null;
  profiles: { full_name: string | null; location: string | null } | null;
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFavorites();
  }, []);

  async function fetchFavorites() {
    try {
      const res = await fetch("/api/favorites?details=1");
      if (!res.ok) return;
      const data = await res.json();
      setFavorites(data.favorites ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function removeFavorite(listingId: string) {
    setFavorites((prev) => prev.filter((f) => f.id !== listingId));
    try {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
    } catch {
      fetchFavorites(); // revert on error
    }
  }

  return (
    <div className="px-4 py-6 space-y-6 md:max-w-2xl md:mx-auto">
      <div className="flex items-center gap-3">
        <Heart size={24} className="text-red-400" />
        <h1 className="text-2xl font-bold">Mina Favoriter</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--usha-muted)]" />
        </div>
      ) : favorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--usha-border)] py-16 text-center">
          <Heart size={32} className="mx-auto mb-3 text-[var(--usha-muted)]" />
          <p className="text-sm text-[var(--usha-muted)]">
            Du har inga sparade favoriter ännu
          </p>
          <Link
            href="/app"
            className="mt-4 inline-block text-xs font-medium text-[var(--usha-gold)] hover:opacity-80"
          >
            Utforska evenemang
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4"
            >
              <div className="flex-1 min-w-0">
                <Link
                  href={`/creators/${fav.profiles ? "profile" : fav.id}`}
                  className="text-sm font-semibold hover:text-[var(--usha-gold)]"
                >
                  {fav.title}
                </Link>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--usha-muted)]">
                  <span>{fav.category}</span>
                  {fav.profiles?.location && (
                    <span className="flex items-center gap-0.5">
                      <MapPin size={10} />
                      {fav.profiles.location}
                    </span>
                  )}
                </div>
                {fav.price != null && (
                  <span className="mt-1 inline-block text-xs font-medium text-[var(--usha-gold)]">
                    {fav.price} SEK
                  </span>
                )}
              </div>
              <button
                onClick={() => removeFavorite(fav.id)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-red-400 transition hover:bg-red-500/10"
                title="Ta bort favorit"
              >
                <Heart size={16} fill="currentColor" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
