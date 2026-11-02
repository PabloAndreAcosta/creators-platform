"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { applyAsInstructor } from "./actions";

/**
 * Ansök om att få undervisa på en öppen kväll. Ansökan gäller hela serien
 * (eller arrangören); arrangören godkänner innan man kan gå med och sälja.
 */
export function ApplyInstructorButton({ listingId }: { listingId: string }) {
  const t = useTranslations("openEvents");
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await applyAsInstructor(listingId, message);
      if (result?.error) {
        toast.error(t("applyErrorTitle"), result.error);
        return;
      }
      toast.success(t("applySentTitle"), t("applySentBody"));
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--usha-gold)] px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90"
      >
        <Send size={14} />
        {t("applyLabel")}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-72">
      <label className="text-xs text-[var(--usha-muted)]">
        {t("applyMessageLabel")}
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder={t("applyMessagePlaceholder")}
          className="mt-1 w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] p-2 text-sm text-[var(--usha-white)]"
        />
      </label>
      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--usha-gold)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {t("applySend")}
        </button>
        <button onClick={() => setOpen(false)} className="text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]">
          {t("applyCancel")}
        </button>
      </div>
    </div>
  );
}
