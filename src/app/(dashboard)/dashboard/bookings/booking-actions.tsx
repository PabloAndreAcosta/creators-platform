"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateBookingStatus } from "./actions";
import { useToast } from "@/components/ui/toaster";
import { Check, X, CheckCircle } from "lucide-react";

const btnBase =
  "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";

export function ConfirmButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const t = useTranslations("bookingsPage");

  function handle() {
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, "confirmed");
      if (result.error) {
        toast.error(t("toastConfirmError"), result.error);
      } else {
        toast.success(t("toastConfirmSuccess"));
      }
    });
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`${btnBase} bg-green-500/10 text-green-400 hover:bg-green-500/20 disabled:opacity-50`}
    >
      <Check size={12} />
      {t("confirmButton")}
    </button>
  );
}

export function CancelButton({
  bookingId,
  isPaid = false,
  paidAmount,
}: {
  bookingId: string;
  isPaid?: boolean;
  paidAmount?: number | null;
}) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const t = useTranslations("bookingsPage");

  function handle() {
    const amountSek = paidAmount != null ? Math.round(paidAmount / 100) : null;
    const message = isPaid
      ? amountSek != null
        ? t("toastCancelConfirmPaidAmount", { amount: amountSek })
        : t("toastCancelConfirmPaid")
      : t("toastCancelConfirm");
    if (!confirm(message)) return;
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, "canceled");
      if (result.error) {
        toast.error(t("toastCancelError"), result.error);
      } else {
        toast.success(isPaid ? t("toastCancelSuccessPaid") : t("toastCancelSuccess"));
      }
    });
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`${btnBase} border border-[var(--usha-border)] text-[var(--usha-muted)] hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50`}
    >
      <X size={12} />
      {isPaid ? t("cancelRefundButton") : t("cancelButton")}
    </button>
  );
}

export function CompleteButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const t = useTranslations("bookingsPage");

  function handle() {
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, "completed");
      if (result.error) {
        toast.error(t("toastCompleteError"), result.error);
      } else {
        toast.success(t("toastCompleteSuccess"));
      }
    });
  }

  return (
    <button
      onClick={handle}
      disabled={isPending}
      className={`${btnBase} bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50`}
    >
      <CheckCircle size={12} />
      {t("completeButton")}
    </button>
  );
}
