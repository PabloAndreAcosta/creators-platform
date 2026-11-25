import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Smartphone } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { loadSwishForConfirm } from "@/lib/swish/confirm";
import { SwishConfirmForm } from "./swish-confirm-form";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Ett Swish-köp att bekräfta — sidan notisen öppnar.
 *
 * Tillfällig väg tills Swish Handel bekräftar automatiskt: säljaren och
 * dörrpersonalen får en notis per köp och avgör det här med ett tryck, utan
 * att leta upp kvällen och listan i entrén. Samma grind (canOperateEntrance)
 * och samma serverlogik (lib/swish/confirm.ts) som dörrens knappar.
 *
 * Notisens "Bekräfta"-knapp (Android) öppnar sidan med ?val=bekrafta. Det
 * bekräftar INGENTING i sig — det framhäver bara knappen, och den inloggade
 * trycker en gång till. Ingen hemlighet i adressen räcker för att bekräfta.
 */
export default async function SwishConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookingId: string }>;
  searchParams: Promise<{ val?: string }>;
}) {
  const { bookingId } = await params;
  const { val } = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/app/swish/bekrafta/${bookingId}`)}`);
  const t = await getTranslations("entrance");

  const admin = createAdminClient();
  const loaded = UUID.test(bookingId)
    ? await loadSwishForConfirm(admin, bookingId, (listing) => canOperateEntrance(admin, user.id, listing))
    : ({ kind: "notFound" } as const);

  if (loaded.kind !== "ok") {
    return (
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="text-xl font-bold">{t("swishConfirmTitle")}</h1>
        <p className="mt-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 text-sm text-[var(--usha-muted)]">
          {loaded.kind === "forbidden" ? t("swishConfirmForbidden") : t("swishConfirmNotFound")}
        </p>
      </div>
    );
  }

  const { booking, listing, checkInDefault } = loaded.view;
  const locale = await getLocale();
  const evening = listing.event_date
    ? new Date(`${listing.event_date}T12:00:00Z`).toLocaleDateString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      }) + (listing.event_time ? ` ${listing.event_time.slice(0, 5)}` : "")
    : null;
  const amount = booking.amount_paid != null ? Math.round(booking.amount_paid / 100) : null;
  const who = booking.guest_name || booking.guest_email || t("guest");

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Smartphone size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-xl font-bold">{t("swishConfirmTitle")}</h1>
      </div>

      <dl className="space-y-3 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 text-sm">
        {amount != null && (
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-[var(--usha-muted)]">{t("swishConfirmAmount")}</dt>
            <dd className="text-2xl font-bold text-[var(--usha-gold)]">{t("priceSek", { price: amount })}</dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--usha-muted)]">{t("swishConfirmEvening")}</dt>
          <dd className="text-right font-medium">
            {listing.title}
            {evening ? <span className="block text-xs font-normal text-[var(--usha-muted)]">{evening}</span> : null}
          </dd>
        </div>
        {booking.ticket_type_name && (
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--usha-muted)]">{t("swishConfirmTicket")}</dt>
            <dd className="text-right">
              {booking.ticket_type_name}
              {booking.guest_count && booking.guest_count > 1 ? ` · ${t("seats", { n: booking.guest_count })}` : ""}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--usha-muted)]">{t("swishConfirmName")}</dt>
          <dd className="text-right">{booking.guest_name || "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-[var(--usha-muted)]">{t("swishConfirmEmail")}</dt>
          <dd className="min-w-0 break-all text-right">{booking.guest_email || "—"}</dd>
        </div>
      </dl>

      {booking.status === "pending" ? (
        <SwishConfirmForm
          listingId={listing.id}
          bookingId={booking.id}
          checkInDefault={checkInDefault}
          preselected={val === "bekrafta"}
          checkText={t("swishConfirmCheck", { amount: amount ?? 0, name: who })}
        />
      ) : (
        <p className="mt-6 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 text-sm">
          {booking.status === "confirmed" || booking.status === "completed"
            ? t("swishConfirmAlreadyConfirmed")
            : t("swishConfirmAlreadyClosed")}
        </p>
      )}

      <Link href={`/app/events/${listing.id}/entre`} className="mt-6 block text-center text-sm text-[var(--usha-muted)] underline">
        {t("swishConfirmToEntrance")}
      </Link>
    </div>
  );
}
