"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { applyToGig } from "@/app/(dashboard)/dashboard/gigs/actions";
import { useToast } from "@/components/ui/toaster";
import { Send, X } from "lucide-react";

export function ApplyToGigButton({ gigId }: { gigId: string }) {
  const t = useTranslations("gigsApply");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handleSubmit() {
    startTransition(async () => {
      const result = await applyToGig(gigId, message);
      if ("error" in result) {
        toast.error(t("errorTitle"), result.error);
        return;
      }
      toast.success(t("successTitle"), t("successBody"));
      setOpen(false);
      setMessage("");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1.5 text-xs font-bold text-black hover:opacity-90"
      >
        <Send size={12} />
        {t("applyButton")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div className="relative w-full max-w-md rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-black)] p-6 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded p-1 text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
            >
              <X size={16} />
            </button>

            <h3 className="mb-4 text-lg font-bold">{t("modalTitle")}</h3>

            <label className="mb-1.5 block text-sm text-[var(--usha-muted)]">
              {t("messageLabel")} <span className="text-xs">{t("optional")}</span>
            </label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("messagePlaceholder")}
              className="w-full resize-none rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 text-sm outline-none transition focus:border-[var(--usha-gold)]/40"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={isPending}
                className="rounded-xl border border-[var(--usha-border)] px-4 py-2 text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)] disabled:opacity-50"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending}
                className="rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2 text-sm font-bold text-black hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? t("submitting") : t("submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
