"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useToast } from "@/components/ui/toaster";

export function ReviewForm({
  bookingId,
  onSubmitted,
}: {
  bookingId: string;
  onSubmitted?: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  async function handleSubmit() {
    if (rating === 0) {
      toast.error("Välj betyg", "Klicka på stjärnorna för att ge ett betyg.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, rating, comment }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Recension sparad!");
        setSubmitted(true);
        onSubmitted?.();
      } else {
        toast.error("Kunde inte spara", data.error);
      }
    } catch {
      toast.error("Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 text-center">
        <p className="text-sm text-green-400">Tack för din recension!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <p className="text-sm font-medium">Lämna en recension</p>

      {/* Stars */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => setRating(star)}
            className="p-0.5 transition-transform hover:scale-110"
          >
            <Star
              size={24}
              className={
                star <= (hovered || rating)
                  ? "fill-[var(--usha-gold)] text-[var(--usha-gold)]"
                  : "text-[var(--usha-muted)]"
              }
            />
          </button>
        ))}
      </div>

      {/* Comment */}
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Beskriv din upplevelse (valfritt)..."
        rows={3}
        className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-black)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
      />

      <button
        onClick={handleSubmit}
        disabled={loading || rating === 0}
        className="w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-2.5 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "Sparar..." : "Skicka recension"}
      </button>
    </div>
  );
}
