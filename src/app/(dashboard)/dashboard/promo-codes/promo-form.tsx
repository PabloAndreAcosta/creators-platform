"use client";

import { useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toaster";
import { createPromoCode } from "./actions";

const inputClass = "w-full min-h-[44px] rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-base sm:text-sm outline-none transition focus:border-[var(--usha-gold)]/40";

export function PromoCodeForm() {
  const t = useTranslations("promoCodes");
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPromoCode(formData);
      if (result.error) {
        toast.error(t("toastErrorTitle"), result.error);
      } else {
        toast.success(t("toastSuccess"));
        formRef.current?.reset();
      }
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">{t("labelCode")}</label>
          <input
            name="code"
            type="text"
            required
            placeholder={t("placeholderCode")}
            className={`${inputClass} font-mono uppercase`}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">{t("labelDiscountPercent")}</label>
          <input name="discount_percent" type="number" min={0} max={100} placeholder={t("placeholderDiscountPercent")} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">{t("labelDiscountAmount")}</label>
          <input name="discount_amount" type="number" min={0} placeholder={t("placeholderDiscountAmount")} className={inputClass} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">{t("labelMaxUses")}</label>
          <input name="max_uses" type="number" min={1} placeholder={t("placeholderMaxUses")} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[var(--usha-muted)]">{t("labelValidUntil")}</label>
          <input name="valid_until" type="date" className={inputClass} />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isPending}
          className="min-h-[44px] rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? t("submitting") : t("submit")}
        </button>
      </div>
    </form>
  );
}
