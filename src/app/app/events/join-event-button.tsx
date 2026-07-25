"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import { joinOpenEvent, leaveOpenEvent } from "./actions";

export function JoinEventButton({
  listingId,
  initialJoined,
}: {
  listingId: string;
  initialJoined: boolean;
}) {
  const t = useTranslations("joinEvent");
  const { toast } = useToast();
  const router = useRouter();
  const [joined, setJoined] = useState(initialJoined);
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    startTransition(async () => {
      const result = await joinOpenEvent(listingId);
      if (result?.error) {
        toast.error(t("joinErrorTitle"), result.error);
        return;
      }
      setJoined(true);
      toast.success(t("joinSuccessTitle"), t("joinSuccessBody"));
      router.refresh();
    });
  }

  function handleLeave() {
    if (!confirm(t("leaveConfirm"))) return;
    startTransition(async () => {
      const result = await leaveOpenEvent(listingId);
      if (result?.error) {
        toast.error(t("leaveErrorTitle"), result.error);
        return;
      }
      setJoined(false);
      toast.success(t("leaveSuccessTitle"), t("leaveSuccessBody"));
      router.refresh();
    });
  }

  if (joined) {
    return (
      <button
        onClick={handleLeave}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-500/10 px-3 py-2 text-sm font-medium text-green-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
      >
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
        {t("joinedLeaveLabel")}
      </button>
    );
  }

  return (
    <button
      onClick={handleJoin}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2 text-sm font-semibold text-black transition hover:opacity-90 disabled:opacity-50"
    >
      {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
      {t("offerServicesLabel")}
    </button>
  );
}
