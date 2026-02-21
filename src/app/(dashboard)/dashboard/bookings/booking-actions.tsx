"use client";

import { useTransition } from "react";
import { updateBookingStatus } from "./actions";
import { useToast } from "@/components/ui/toaster";
import { Check, X, CheckCircle } from "lucide-react";

const btnBase =
  "flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors";

export function ConfirmButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handle() {
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, "confirmed");
      if (result.error) {
        toast.error("Kunde inte bekräfta bokning", result.error);
      } else {
        toast.success("Bokning bekräftad");
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
      Bekräfta
    </button>
  );
}

export function CancelButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handle() {
    if (!confirm("Är du säker på att du vill avboka?")) return;
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, "canceled");
      if (result.error) {
        toast.error("Kunde inte avboka", result.error);
      } else {
        toast.success("Bokning avbokad");
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
      Avboka
    </button>
  );
}

export function CompleteButton({ bookingId }: { bookingId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  function handle() {
    startTransition(async () => {
      const result = await updateBookingStatus(bookingId, "completed");
      if (result.error) {
        toast.error("Kunde inte uppdatera bokning", result.error);
      } else {
        toast.success("Bokning markerad som slutförd");
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
      Slutförd
    </button>
  );
}
