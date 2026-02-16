"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/toaster";
import { CATEGORIES } from "@/lib/categories";

interface Listing {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
}

export default function ListingForm({
  listing,
  action,
}: {
  listing?: Listing;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result) {
        toast({ title: "Fel", description: result.error, variant: "error" });
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Titel
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          defaultValue={listing?.title || ""}
          placeholder="t.ex. Privat danslektion"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Beskrivning
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={listing?.description || ""}
          placeholder="Beskriv vad som ingår i tjänsten..."
          className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Category + Price */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Kategori
          </label>
          <select
            id="category"
            name="category"
            required
            defaultValue={listing?.category || ""}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          >
            <option value="">Välj kategori...</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="price" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
            Pris (SEK)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            defaultValue={listing?.price ?? ""}
            placeholder="t.ex. 500"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
      </div>

      {/* Duration */}
      <div className="sm:w-1/2">
        <label htmlFor="duration_minutes" className="mb-1.5 block text-sm text-[var(--usha-muted)]">
          Längd (minuter)
        </label>
        <input
          id="duration_minutes"
          name="duration_minutes"
          type="number"
          min={0}
          step={15}
          defaultValue={listing?.duration_minutes ?? ""}
          placeholder="t.ex. 60"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Sparar..." : listing ? "Spara ändringar" : "Skapa tjänst"}
        </button>
      </div>
    </form>
  );
}
