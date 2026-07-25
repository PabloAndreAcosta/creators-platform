"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { acceptApplication, declineApplication } from "../actions";
import { useToast } from "@/components/ui/toaster";
import { Check, X } from "lucide-react";

export function GigApplicationActions({ applicationId }: { applicationId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const t = useTranslations("gigApplicationActions");

  function handleAccept() {
    if (!confirm(t("confirmAccept"))) return;
    startTransition(async () => {
      const result = await acceptApplication(applicationId);
      if ("error" in result) {
        toast.error(t("acceptErrorTitle"), result.error);
      } else {
        toast.success(t("acceptSuccessTitle"), t("acceptSuccessMessage"));
      }
    });
  }

  function handleDecline() {
    if (!confirm(t("confirmDecline"))) return;
    startTransition(async () => {
      const result = await declineApplication(applicationId);
      if ("error" in result) {
        toast.error(t("declineErrorTitle"), result.error);
      } else {
        toast.success(t("declineSuccessTitle"));
      }
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={handleAccept}
        disabled={isPending}
        className="flex items-center gap-1 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 disabled:opacity-50"
      >
        <Check size={12} />
        {t("acceptButton")}
      </button>
      <button
        type="button"
        onClick={handleDecline}
        disabled={isPending}
        className="flex items-center gap-1 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium text-[var(--usha-muted)] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        <X size={12} />
        {t("declineButton")}
      </button>
    </div>
  );
}
