import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "@/lib/notifications/create";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking";
import { stockholmLocalToUtcISO } from "@/lib/time";
import { eveningInProgress } from "@/lib/tickets/evening";

/**
 * Att avgöra ett vilande Swish-köp — EN funktion för alla vägar dit.
 *
 * Gästen tryckte "Jag har swishat" på eventsidan och fick en vilande bokning
 * (status pending, payment_method swish). Någon har sedan jämfört mot
 * Swish-appen. Bekräfta = bokningen blir bekräftad, biljetten räknas och
 * QR-koden mejlas, och gästen checkas in om hen står i dörren. Avvisa =
 * bokningen avbokas (ingen betalning hittades) och gästen får veta.
 *
 * Används av dörrens knappar (POST /api/events/[id]/entry/swish/confirm),
 * bekräftelsesidan från notisen (/app/swish/bekrafta/[bookingId]) och
 * — när den finns — Swish Handels återanrop. Behörigheten kontrolleras INTE
 * här: anroparen gör det (canOperateEntrance för en människa, certifikatet
 * för Swish Handel). Funktionen tar bara emot vem som avgjorde, för noteringen.
 *
 * Kräver en service-role-klient.
 */

export type SwishDecision = "confirm" | "reject";

export interface SwishListing {
  id: string;
  user_id: string;
  title: string;
  event_date: string | null;
  event_time: string | null;
  event_end_time: string | null;
  event_location: string | null;
  organizer_name: string | null;
}

export const SWISH_LISTING_SELECT =
  "id, user_id, title, event_date, event_time, event_end_time, event_location, organizer_name";

export type SwishDecisionResult =
  | { ok: true; status: "confirmed"; checkedIn: boolean; emailed: boolean }
  | { ok: true; status: "canceled" }
  | { ok: false; error: "notPending" | "updateFailed"; httpStatus: 409 | 500 };

export interface DecideSwishOptions {
  listing: SwishListing;
  bookingId: string;
  action: SwishDecision;
  /** Checka in gästen samtidigt. Bara vid bekräftelse. */
  checkIn?: boolean;
  /** Vem som avgjorde (användar-id), för noteringen och scanned_by. */
  decidedBy: string;
  /** Var det avgjordes, för noteringen: "i entrén", "från notisen". */
  via?: string;
}

/** Avgör ett vilande Swish-köp på just det här evenemanget. */
export async function decideSwishBooking(admin: SupabaseClient, opts: DecideSwishOptions): Promise<SwishDecisionResult> {
  const { listing, bookingId, action, decidedBy } = opts;
  const via = opts.via ?? "i entrén";

  // Bokningen måste höra till DET HÄR evenemanget och fortfarande vara vilande.
  // Annars kunde en entrévärd bekräfta något annat, eller samma köp två gånger
  // (och räkna biljetten dubbelt).
  const { data: booking } = await admin
    .from("bookings")
    .select("id, customer_id, guest_name, guest_email, amount_paid, guest_count, ticket_type_id, ticket_type_name, scheduled_at, notes")
    .eq("id", bookingId)
    .eq("listing_id", listing.id)
    .eq("payment_method", "swish")
    .eq("status", "pending")
    .maybeSingle();
  if (!booking) return { ok: false, error: "notPending", httpStatus: 409 };

  const now = new Date().toISOString();
  const service = booking.ticket_type_name ? `${listing.title} · ${booking.ticket_type_name}` : listing.title;

  if (action === "reject") {
    const { error } = await admin
      .from("bookings")
      .update({ status: "canceled", notes: `${booking.notes ?? ""}\nAvvisad ${via} av ${decidedBy}: ingen Swish-betalning hittades`.trim() })
      .eq("id", booking.id)
      .eq("status", "pending");
    if (error) return { ok: false, error: "updateFailed", httpStatus: 500 };
    if (booking.customer_id) {
      await createNotification({
        userId: booking.customer_id,
        type: "booking_canceled",
        titleKey: "swishRejectedTitle",
        bodyKey: "swishRejectedMsg",
        params: { service },
        link: "/app/tickets",
      }).catch((e) => console.error("Swish reject notification failed:", e));
    }
    return { ok: true, status: "canceled" };
  }

  const checkIn = opts.checkIn === true;
  const { data: updated, error } = await admin
    .from("bookings")
    .update({
      status: "confirmed",
      ...(checkIn ? { checked_in_at: now, scanned_by: decidedBy } : {}),
      notes: `${booking.notes ?? ""}\nSwish bekräftad ${via} av ${decidedBy}`.trim(),
    })
    .eq("id", booking.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error || !updated) return { ok: false, error: "updateFailed", httpStatus: 500 };

  const guestCount = booking.guest_count ?? 1;
  await admin
    .rpc("increment_tickets_sold", { p_listing: listing.id, p_n: guestCount, p_ticket_type: booking.ticket_type_id ?? undefined })
    .then(({ error: e }: { error: unknown }) => e && console.error("increment_tickets_sold failed (swish confirm):", e));

  const { data: owner } = await admin
    .from("profiles")
    .select("company_name, org_number, full_name")
    .eq("id", listing.user_id)
    .maybeSingle();

  if (booking.guest_email) {
    const scheduledAt = new Date(booking.scheduled_at ?? now);
    const endIso = listing.event_date && listing.event_end_time ? stockholmLocalToUtcISO(`${listing.event_date}T${listing.event_end_time}`) : null;
    sendBookingConfirmationEmail({
      to: booking.guest_email,
      customerName: booking.guest_name || "Gäst",
      serviceName: service,
      scheduledAt,
      scheduledEndAt: endIso ? new Date(endIso) : undefined,
      creatorName: listing.organizer_name || owner?.full_name || "Usha",
      location: listing.event_location || undefined,
      bookingId: booking.id,
      seller: { name: owner?.company_name || owner?.full_name || "Usha AB", orgNumber: owner?.org_number ?? undefined },
      amountOre: booking.amount_paid ?? undefined,
      customerId: booking.customer_id ?? undefined,
    }).catch((e) => console.error("Swish confirm email failed:", e));
  }

  if (booking.customer_id) {
    await createNotification({
      userId: booking.customer_id,
      type: "booking_confirmed",
      titleKey: "swishConfirmedTitle",
      bodyKey: "swishConfirmedMsg",
      params: { service },
      link: `/biljett/${booking.id}`,
    }).catch((e) => console.error("Swish confirm notification failed:", e));
  }

  return { ok: true, status: "confirmed", checkedIn: checkIn, emailed: !!booking.guest_email };
}

export interface SwishConfirmView {
  booking: {
    id: string;
    status: string;
    guest_name: string | null;
    guest_email: string | null;
    amount_paid: number | null;
    guest_count: number | null;
    ticket_type_name: string | null;
  };
  listing: SwishListing;
  /** "Gästen står här" förvalt: bara medan kvällen pågår. */
  checkInDefault: boolean;
}

export type SwishConfirmLoad =
  | { kind: "notFound" }
  | { kind: "forbidden" }
  | { kind: "ok"; view: SwishConfirmView };

/**
 * Bekräftelsesidan från notisen: hämta ETT Swish-köp och avgör om den
 * inloggade får se det. Samma grind som dörren (canOperate = canOperateEntrance),
 * och ingenting om köpet (namn, e-post, belopp) lämnar funktionen förrän
 * grinden släppt igenom. Köp som redan avgjorts returneras ändå, så sidan kan
 * säga "redan bekräftat" i stället för "finns inte" när två i dörren trycker.
 */
export async function loadSwishForConfirm(
  admin: SupabaseClient,
  bookingId: string,
  canOperate: (listing: SwishListing) => Promise<boolean>,
  now: Date = new Date()
): Promise<SwishConfirmLoad> {
  const { data: booking } = await admin
    .from("bookings")
    .select("id, listing_id, status, guest_name, guest_email, amount_paid, guest_count, ticket_type_name")
    .eq("id", bookingId)
    .eq("payment_method", "swish")
    .maybeSingle();
  if (!booking?.listing_id) return { kind: "notFound" };

  const { data: listing } = await admin.from("listings").select(SWISH_LISTING_SELECT).eq("id", booking.listing_id).maybeSingle();
  if (!listing) return { kind: "notFound" };
  if (!(await canOperate(listing as SwishListing))) return { kind: "forbidden" };

  const b = booking as SwishConfirmView["booking"];
  return {
    kind: "ok",
    view: {
      booking: {
        id: b.id,
        status: b.status,
        guest_name: b.guest_name,
        guest_email: b.guest_email,
        amount_paid: b.amount_paid,
        guest_count: b.guest_count,
        ticket_type_name: b.ticket_type_name,
      },
      listing: listing as SwishListing,
      checkInDefault: eveningInProgress(listing as SwishListing, now),
    },
  };
}
