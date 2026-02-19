'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Recommendation {
  id: string;
  title: string;
  price: number;
  creator: {
    id: string;
    name: string | null;
    avatar: string | null;
  };
  category: string;
  eventTier: string;
  bookingCount: number;
}

function sek(amount: number): string {
  return amount.toLocaleString('sv-SE');
}

const CATEGORY_COLORS: Record<string, string> = {
  dance: 'bg-pink-500/10 text-pink-400',
  music: 'bg-blue-500/10 text-blue-400',
  photo: 'bg-amber-500/10 text-amber-400',
  yoga: 'bg-green-500/10 text-green-400',
  food: 'bg-orange-500/10 text-orange-400',
};

export default function RecommendedEvents() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchRecommendations() {
      try {
        const res = await fetch('/api/recommendations?limit=5');
        if (!res.ok) throw new Error('Fetch failed');
        const data = await res.json();
        setRecommendations(data.recommendations ?? []);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchRecommendations();
  }, []);

  if (loading) return <RecommendedSkeleton />;

  if (error) {
    return (
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--usha-white)]">
          Rekommenderat för dig
        </h2>
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-center">
          <p className="text-sm text-[var(--usha-muted)]">
            Kunde inte ladda rekommendationer just nu
          </p>
        </div>
      </section>
    );
  }

  const isEmpty = recommendations.length === 0;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-[var(--usha-white)]">
        Rekommenderat för dig
      </h2>

      {isEmpty && (
        <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-center mb-4">
          <p className="text-sm text-[var(--usha-muted)]">
            Gör din första bokning för att få personliga rekommendationer
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recommendations.map((rec) => (
          <EventCard key={rec.id} event={rec} />
        ))}
      </div>
    </section>
  );
}

function EventCard({ event }: { event: Recommendation }) {
  const categoryStyle =
    CATEGORY_COLORS[event.category] ?? 'bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]';

  return (
    <div className="group rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden hover:border-[var(--usha-gold)]/30 transition-colors">
      {/* Image placeholder */}
      <div className="relative h-36 bg-gradient-to-br from-[var(--usha-card-hover)] to-[var(--usha-border)]">
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-[var(--usha-muted)]/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </div>

        {/* Event tier badge */}
        {event.eventTier && (
          <span className="absolute top-2 right-2 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/50 text-[var(--usha-gold)]">
            Tier {event.eventTier.toUpperCase()}
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        {/* Category + popularity */}
        <div className="flex items-center justify-between">
          <span className={cn('text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full', categoryStyle)}>
            {event.category}
          </span>
          {event.bookingCount > 0 && (
            <span className="text-[10px] text-[var(--usha-muted)]">
              {event.bookingCount} bokningar
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-[var(--usha-white)] line-clamp-2 leading-tight">
          {event.title}
        </h3>

        {/* Creator */}
        <div className="flex items-center gap-2">
          {event.creator.avatar ? (
            <img
              src={event.creator.avatar}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-[var(--usha-border)] flex items-center justify-center">
              <span className="text-[9px] font-bold text-[var(--usha-muted)]">
                {(event.creator.name ?? '?')[0]?.toUpperCase()}
              </span>
            </div>
          )}
          <span className="text-xs text-[var(--usha-muted)] truncate">
            {event.creator.name ?? 'Okänd kreatör'}
          </span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-base font-bold text-[var(--usha-white)]">
            {sek(event.price)} <span className="text-xs text-[var(--usha-muted)] font-normal">SEK</span>
          </span>
          <Button
            size="sm"
            className="bg-[var(--usha-gold)] hover:bg-[var(--usha-gold-light)] text-black text-xs font-semibold px-4"
            onClick={() => {
              window.location.href = `/creators/${event.creator.id}?listing=${event.id}`;
            }}
          >
            Boka Nu
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecommendedSkeleton() {
  return (
    <section className="space-y-4">
      <div className="h-6 w-48 bg-[var(--usha-card)] rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden animate-pulse"
          >
            <div className="h-36 bg-[var(--usha-card-hover)]" />
            <div className="p-4 space-y-3">
              <div className="h-3 w-16 bg-[var(--usha-border)] rounded" />
              <div className="h-4 w-3/4 bg-[var(--usha-border)] rounded" />
              <div className="h-3 w-24 bg-[var(--usha-border)] rounded" />
              <div className="flex justify-between">
                <div className="h-5 w-16 bg-[var(--usha-border)] rounded" />
                <div className="h-8 w-20 bg-[var(--usha-border)] rounded" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
