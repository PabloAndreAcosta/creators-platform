"use client";

import { useState, useEffect } from "react";
import { Loader2, MapPin, Calendar, Sparkles } from "lucide-react";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";

interface RecommendedEvent {
  id: string;
  title: string;
  category: string;
  price: number | null;
  event_date: string | null;
  event_location: string | null;
  image_url: string | null;
  profiles: { full_name: string | null } | null;
  score?: number;
}

export default function RecommendationsPage() {
  const [events, setEvents] = useState<RecommendedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recommendations?limit=20")
      .then((r) => r.json())
      .then((data) => setEvents(data.recommendations ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-4 py-6 space-y-6 md:max-w-3xl md:mx-auto">
      <div className="flex items-center gap-3">
        <Sparkles size={24} className="text-[var(--usha-gold)]" />
        <div>
          <h1 className="text-2xl font-bold">Rekommendationer</h1>
          <p className="text-xs text-[var(--usha-muted)]">
            Anpassade förslag baserat på dina intressen
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--usha-muted)]" />
        </div>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--usha-border)] py-16 text-center">
          <Sparkles size={32} className="mx-auto mb-3 text-[var(--usha-muted)]" />
          <p className="text-sm text-[var(--usha-muted)]">
            Inga rekommendationer ännu — boka eller favoritmarkera fler events!
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="group overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] transition hover:border-[var(--usha-gold)]/20"
            >
              {/* Image */}
              <div className="relative h-36 bg-gradient-to-br from-[var(--usha-gold)]/10 to-[var(--usha-accent)]/10">
                {event.image_url ? (
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <Calendar size={24} className="text-[var(--usha-muted)]" />
                  </div>
                )}
                <div className="absolute right-2 top-2">
                  <FavoriteButton listingId={event.id} isLoggedIn />
                </div>
              </div>

              {/* Info */}
              <Link href={`/app`} className="block p-4">
                <h3 className="mb-1 truncate text-sm font-semibold group-hover:text-[var(--usha-gold)]">
                  {event.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-[var(--usha-muted)]">
                  {event.profiles?.full_name && (
                    <span>{event.profiles.full_name}</span>
                  )}
                  <span>{event.category}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  {event.price != null ? (
                    <span className="text-xs font-semibold text-[var(--usha-gold)]">
                      {event.price} SEK
                    </span>
                  ) : (
                    <span className="text-xs text-green-400">Gratis</span>
                  )}
                  {event.event_location && (
                    <span className="flex items-center gap-0.5 text-[10px] text-[var(--usha-muted)]">
                      <MapPin size={10} />
                      {event.event_location}
                    </span>
                  )}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
