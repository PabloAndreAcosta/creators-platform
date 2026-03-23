"use client";

import { useTransition, useRef } from "react";
import { useToast } from "@/components/ui/toaster";
import { createPromoCode } from "./actions";

const inputClass = "w-full min-h-[44px] rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm outline-none transition focus:border-[var(--usha-gold)]/40";

export function PromoCodeForm() {
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPromoCode(formData);
      if (result.error) {
        toast.error("Kunde inte skapa kod", result.error);
      } else {
        toast.success("Promo-kod skapad");
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Kod</label>
          <input
            name="code"
            type="text"
            required
            placeholder="t.ex. PABLO20"
            className={`${inputClass} font-mono uppercase`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Rabatt (%)</label>
          <input name="discount_percent" type="number" min={0} max={100} placeholder="t.ex. 20" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Eller fast belopp (SEK)</label>
          <input name="discount_amount" type="number" min={0} placeholder="t.ex. 50" className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Max användningar (lämna tomt = obegränsat)</label>
          <input name="max_uses" type="number" min={1} placeholder="Obegränsat" className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">Gäller t.o.m.</label>
          <input name="valid_until" type="date" className={inputClass} />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? "Skapar..." : "Skapa kod"}
        </button>
      </div>
    </form>
  );
}
