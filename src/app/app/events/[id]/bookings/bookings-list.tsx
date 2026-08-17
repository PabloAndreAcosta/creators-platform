"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefundButton } from "@/app/(dashboard)/dashboard/bookings/booking-actions";

export interface BookingRow {
  id: string;
  name: string;
  email: string | null;
  status: string;
  /** I öre, som i databasen. */
  amountPaid: number;
  isFree: boolean;
  guestCount: number;
  ticketTypeName: string | null;
  refundedAt: string | null;
  refundAmount: number | null;
  canRefund: boolean;
  createdAt: string;
}

export function BookingsList({ bookings }: { bookings: BookingRow[] }) {
  const t = useTranslations("eventBookings");
  const router = useRouter();

  if (!bookings.length) {
    return (
      <p className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-sm text-[var(--usha-muted)]">
        {t("empty")}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {bookings.map((b) => (
        <div
          key={b.id}
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{b.name}</p>
                <StatusBadge row={b} />
              </div>
              {b.email && (
                <p className="truncate text-xs text-[var(--usha-muted)]">{b.email}</p>
              )}
              <p className="mt-1 text-xs text-[var(--usha-muted)]">
                {b.ticketTypeName ? `${b.ticketTypeName} · ` : ""}
                {b.guestCount > 1 ? `${t("guestCount", { count: b.guestCount })} · ` : ""}
                {b.createdAt}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-2">
              <span className="text-sm font-semibold tabular-nums">
                {b.isFree || b.amountPaid === 0
                  ? t("freeLabel")
                  : `${Math.round(b.amountPaid / 100)} kr`}
              </span>
              {b.canRefund && (
                <RefundButton
                  bookingId={b.id}
                  paidAmount={b.amountPaid}
                  onDone={() => router.refresh()}
                />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusBadge({ row }: { row: BookingRow }) {
  const t = useTranslations("eventBookings");

  if (row.refundedAt) {
    const sek = row.refundAmount != null ? Math.round(row.refundAmount / 100) : null;
    return (
      <span className="rounded-full bg-[var(--usha-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--usha-muted)]">
        {sek != null ? t("refundedAmount", { amount: sek }) : t("refunded")}
      </span>
    );
  }

  if (row.status === "canceled") {
    return (
      <span className="rounded-full bg-[var(--usha-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--usha-muted)]">
        {t("statusCanceled")}
      </span>
    );
  }

  if (row.status === "pending") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
        {t("statusPending")}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">
      {t("statusConfirmed")}
    </span>
  );
}
