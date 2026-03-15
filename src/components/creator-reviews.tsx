"use client";

import { useState, useEffect } from "react";
import { Star } from "lucide-react";

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
  listings: { title: string } | null;
}

export function CreatorReviews({ creatorId }: { creatorId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/reviews?creatorId=${creatorId}`)
      .then((r) => r.json())
      .then((data) => {
        setReviews(data.reviews ?? []);
        setAverage(data.average);
        setCount(data.count);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [creatorId]);

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-5 w-32 rounded bg-[var(--usha-card)]" />
        <div className="h-20 rounded-xl bg-[var(--usha-card)]" />
      </div>
    );
  }

  if (count === 0) return null;

  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-bold">Recensioner</h2>
        <div className="flex items-center gap-1">
          <Star size={16} className="fill-[var(--usha-gold)] text-[var(--usha-gold)]" />
          <span className="text-sm font-semibold">{average}</span>
          <span className="text-sm text-[var(--usha-muted)]">({count})</span>
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((review) => {
          const reviewer = review.profiles as { full_name: string | null; avatar_url: string | null } | null;
          const listing = review.listings as { title: string } | null;
          return (
            <div
              key={review.id}
              className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--usha-border)]">
                    <span className="text-xs font-bold text-[var(--usha-muted)]">
                      {(reviewer?.full_name || "?")[0]?.toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium">
                    {reviewer?.full_name || "Anonym"}
                  </span>
                </div>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      size={12}
                      className={
                        s <= review.rating
                          ? "fill-[var(--usha-gold)] text-[var(--usha-gold)]"
                          : "text-[var(--usha-muted)]"
                      }
                    />
                  ))}
                </div>
              </div>
              {listing?.title && (
                <p className="mb-1 text-xs text-[var(--usha-muted)]">
                  {listing.title}
                </p>
              )}
              {review.comment && (
                <p className="text-sm text-[var(--usha-muted)]">
                  {review.comment}
                </p>
              )}
              <p className="mt-2 text-[10px] text-[var(--usha-muted)]">
                {new Date(review.created_at).toLocaleDateString("sv-SE")}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
