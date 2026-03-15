"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

export function FavoriteButton({
  listingId,
  initialFavorited = false,
  isLoggedIn = false,
}: {
  listingId: string;
  initialFavorited?: boolean;
  isLoggedIn?: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!isLoggedIn) return;
    if (loading) return;

    setLoading(true);
    setFavorited(!favorited);

    try {
      const res = await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      if (res.ok) {
        const data = await res.json();
        setFavorited(data.favorited);
      } else {
        setFavorited(favorited); // revert
      }
    } catch {
      setFavorited(favorited); // revert
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/60"
      aria-label={favorited ? "Ta bort favorit" : "Spara som favorit"}
    >
      <Heart
        size={16}
        className={favorited ? "fill-red-500 text-red-500" : "text-white"}
      />
    </button>
  );
}
