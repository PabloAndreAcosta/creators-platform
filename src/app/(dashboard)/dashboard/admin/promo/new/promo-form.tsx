"use client";

import { useState, useTransition } from "react";
import { createPromoCode } from "../actions";
import { useToast } from "@/components/ui/toaster";

export function PromoForm() {
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createPromoCode(formData);
      if (result?.error) {
        setError(result.error);
        toast.error("Kunde inte skapa", result.error);
      }
    });
  }

  return (
    <form action={handleSubmit} className="max-w-xl space-y-6">
      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Code */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Kod</label>
        <input
          name="code"
          type="text"
          required
          placeholder="T.ex. SOMMAR2026"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm font-mono uppercase tracking-wider outline-none transition focus:border-[var(--usha-gold)]/40 placeholder:normal-case placeholder:tracking-normal"
        />
        <p className="mt-1 text-xs text-[var(--usha-muted)]">
          Koden konverteras automatiskt till versaler.
        </p>
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Beskrivning <span className="text-xs text-[var(--usha-muted)]">(valfritt)</span>
        </label>
        <input
          name="description"
          type="text"
          placeholder="Intern beskrivning av kampanjen"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
      </div>

      {/* Discount type + value */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Rabattyp</label>
          <select
            name="discount_type"
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as "percent" | "fixed")}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          >
            <option value="percent">Procent (%)</option>
            <option value="fixed">Fast belopp (SEK)</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            {discountType === "percent" ? "Rabatt (%)" : "Rabatt (SEK)"}
          </label>
          <input
            name="discount_value"
            type="number"
            required
            min={1}
            max={discountType === "percent" ? 100 : undefined}
            step={discountType === "percent" ? 1 : 0.01}
            placeholder={discountType === "percent" ? "20" : "100"}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
      </div>

      {/* Scope */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">Gäller för</label>
        <select
          name="scope"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        >
          <option value="both">Allt (prenumeration + biljetter)</option>
          <option value="subscription">Bara prenumeration</option>
          <option value="ticket">Bara biljetter</option>
        </select>
      </div>

      {/* Usage limits */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Max användningar totalt <span className="text-xs text-[var(--usha-muted)]">(valfritt)</span>
          </label>
          <input
            name="max_uses"
            type="number"
            min={1}
            placeholder="Obegränsat"
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            Max per användare
          </label>
          <input
            name="max_uses_per_user"
            type="number"
            min={1}
            defaultValue={1}
            className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
          />
        </div>
      </div>

      {/* Valid until */}
      <div>
        <label className="mb-1.5 block text-sm font-medium">
          Giltig till <span className="text-xs text-[var(--usha-muted)]">(valfritt)</span>
        </label>
        <input
          name="valid_until"
          type="datetime-local"
          className="w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
        />
        <p className="mt-1 text-xs text-[var(--usha-muted)]">
          Lämna tomt för ingen utgångsdatum.
        </p>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
      >
        {isPending ? "Skapar..." : "Skapa promokod"}
      </button>
    </form>
  );
}
