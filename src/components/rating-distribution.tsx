"use client";

import { Star } from "lucide-react";

interface RatingDistributionProps {
  reviews: Array<{ rating: number }>;
}

export function RatingDistribution({ reviews }: RatingDistributionProps) {
  if (!reviews || reviews.length === 0) return null;

  const counts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }));

  const maxCount = Math.max(...counts.map((c) => c.count), 1);

  return (
    <div className="space-y-1.5">
      {counts.map(({ star, count }) => {
        const percentage = (count / maxCount) * 100;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="w-3 text-xs font-medium text-right">{star}</span>
            <Star
              size={12}
              className="fill-[var(--usha-gold)] text-[var(--usha-gold)] shrink-0"
            />
            <div className="flex-1 h-2 rounded-full bg-[var(--usha-border)] overflow-hidden">
              {count > 0 && (
                <div
                  className="h-full rounded-full bg-[var(--usha-gold)]"
                  style={{ width: `${percentage}%` }}
                />
              )}
            </div>
            <span className="w-5 text-xs text-[var(--usha-muted)] text-right tabular-nums">
              {count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
