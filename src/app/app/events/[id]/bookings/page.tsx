import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canManageListing } from "@/lib/listings/manage-access";
import { hasVenueCapabilityForListing } from "@/lib/venues/listing-access";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";
import { BookingsList, type BookingRow } from "./bookings-list";

// Bokningar och återbetalning per event.
//
// Återbetalning fanns bara på live-vyn, som man når via trepunktsmenyn på
// eventkortet under namnet "Live-dashboard". Ingen som vill betala tillbaka en
// biljett två månader före eventet letar där, så i praktiken gick det inte att
// göra från appen. Den här sidan är den självklara platsen: alla bokningar på
// eventet, med återbetalning där den hör hemma.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getTranslations("eventBookings");
  return { title: `${t("title")} – Usha Platform` };
}

export default async function EventBookingsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const t = await getTranslations("eventBookings");
  const locale = await getLocale();
  const dateFmt = locale === "en" ? "en-GB" : locale === "es" ? "es-ES" : "sv-SE";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("id, title, user_id")
    .eq("id", id)
    .maybeSingle();

  // Ägare eller accepterad medarrangör — samma grind som väntelistan.
  // Ägare, medarrangör, eller den som håller `bookings` i lokalens team.
  // Dörrvärden behöver gästlistan men ska inte kunna redigera evenemanget, så
  // `bookings` prövas separat från `events`.
  const farSeGastlistan =
    listing?.user_id === user.id ||
    (await canManageListing(admin, user.id, id)) ||
    (await hasVenueCapabilityForListing(admin, user.id, id, "bookings"));

  if (!listing || !farSeGastlistan) {
    notFound();
  }

  const { data: rows } = await admin
    .from("bookings")
    .select(
      "id, guest_name, guest_email, customer_id, status, amount_paid, is_free, guest_count, ticket_type_name, refunded_at, refund_amount, stripe_payment_id, created_at"
    )
    .eq("listing_id", id)
    .order("created_at", { ascending: false });

  const all = rows ?? [];

  // Namn på inloggade köpare finns på profilen, inte på bokningen.
  const customerIds = [...new Set(all.map((b) => b.customer_id).filter((x): x is string => !!x))];
  const profiles = customerIds.length
    ? (
        await admin
          .from("profiles")
          .select("id, full_name, contact_email")
          .in("id", customerIds)
      ).data ?? []
    : [];
  const byId = new Map(profiles.map((p) => [p.id, p]));

  const bookings: BookingRow[] = all.map((b) => {
    const profile = b.customer_id ? byId.get(b.customer_id) : null;
    return {
      id: b.id,
      name: b.guest_name || profile?.full_name || t("unknownGuest"),
      email: b.guest_email || profile?.contact_email || null,
      status: b.status,
      amountPaid: b.amount_paid ?? 0,
      isFree: !!b.is_free,
      guestCount: b.guest_count ?? 1,
      ticketTypeName: b.ticket_type_name,
      refundedAt: b.refunded_at,
      refundAmount: b.refund_amount,
      // Utan betalnings-id finns ingenting att betala tillbaka, oavsett belopp.
      canRefund:
        !!b.stripe_payment_id &&
        (b.amount_paid ?? 0) > 0 &&
        b.status === "confirmed" &&
        !b.refunded_at,
      createdAt: new Date(b.created_at).toLocaleDateString(dateFmt, {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    };
  });

  const paidCount = bookings.filter((b) => b.amountPaid > 0 && !b.refundedAt).length;
  const grossSek = Math.round(
    bookings
      .filter((b) => !b.refundedAt)
      .reduce((sum, b) => sum + b.amountPaid, 0) / 100
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4 py-6">
      <div className="space-y-3">
        <Link
          href="/app/events"
          className="inline-flex items-center gap-1 text-sm text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
        >
          <ChevronLeft size={16} />
          {t("back")}
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-[var(--usha-muted)]">{listing.title}</p>
        </div>
      </div>

      <div className="flex gap-6 border-y border-[var(--usha-border)] py-3">
        <div>
          <p className="text-lg font-semibold tabular-nums">{bookings.length}</p>
          <p className="text-xs text-[var(--usha-muted)]">{t("totalLabel")}</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">{paidCount}</p>
          <p className="text-xs text-[var(--usha-muted)]">{t("paidLabel")}</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">{grossSek} kr</p>
          <p className="text-xs text-[var(--usha-muted)]">{t("grossLabel")}</p>
        </div>
      </div>

      <BookingsList bookings={bookings} />
    </div>
  );
}
