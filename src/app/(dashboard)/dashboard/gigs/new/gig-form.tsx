"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui/toaster";

const inputClass =
  "w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40";

export function GigForm({
  action,
}: {
  action: (formData: FormData) => Promise<{ error?: string } | void>;
}) {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      if (result && "error" in result && result.error) {
        toast.error("Kunde inte publicera gig", result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-6 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 sm:p-8">
      <div>
        <label htmlFor="title" className="mb-1.5 block text-sm text-[var(--usha-muted)]">Titel</label>
        <input id="title" name="title" type="text" required placeholder="t.ex. Tango-kväll på Berns 2026-06-14" className={inputClass} />
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm text-[var(--usha-muted)]">Beskrivning</label>
        <textarea id="description" name="description" rows={4} placeholder="Tema, dresscode, antal förväntade gäster, vad du letar efter hos dansaren..." className={`${inputClass} resize-none`} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="event_date" className="mb-1.5 block text-sm text-[var(--usha-muted)]">Datum</label>
          <input id="event_date" name="event_date" type="date" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="event_time" className="mb-1.5 block text-sm text-[var(--usha-muted)]">Starttid</label>
          <input id="event_time" name="event_time" type="time" className={inputClass} />
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="venue" className="mb-1.5 block text-sm text-[var(--usha-muted)]">Lokal</label>
          <input id="venue" name="venue" type="text" placeholder="t.ex. Berns Stockholm" className={inputClass} />
        </div>
        <div>
          <label htmlFor="venue_address" className="mb-1.5 block text-sm text-[var(--usha-muted)]">Adress</label>
          <input id="venue_address" name="venue_address" type="text" placeholder="Gata, ort" className={inputClass} />
        </div>
      </div>

      <div>
        <label htmlFor="proposed_price" className="mb-1.5 block text-sm text-[var(--usha-muted)]">Föreslagen ersättning (SEK)</label>
        <input id="proposed_price" name="proposed_price" type="number" min={0} required placeholder="t.ex. 5000" className={inputClass} />
      </div>

      <div>
        <label htmlFor="perks" className="mb-1.5 block text-sm text-[var(--usha-muted)]">Förmåner <span className="text-xs">(valfritt)</span></label>
        <textarea id="perks" name="perks" rows={2} placeholder="t.ex. gratis entré, dryckespaket, måltid, parkering, hotell" className={`${inputClass} resize-none`} />
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Publicerar..." : "Publicera gig"}
        </button>
      </div>
    </form>
  );
}
