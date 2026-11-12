import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { createNotification } from "@/lib/notifications/create";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking";
import { stockholmLocalToUtcISO } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/events/[id]/entry/swish/confirm — avgör ett vilande Swish-köp.
 * { bookingId, action: "confirm" | "reject", checkIn?: boolean }
 *
 * Gästen tryckte "Jag har swishat" på eventsidan; den som sköter entrén har
 * jämfört mot Swish-appen. Bekräfta = bokningen blir bekräftad, biljetten
 * räknas och QR-koden mejlas — och checkas in direkt om gästen står i dörren.
 * Avvisa = bokningen avbokas (ingen betalning hittades), gästen får veta.
 *
 * Samma grind som registreringen i dörren: bara den som får sköta entrén.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(getRateLimitKey(req, "entry-swish-confirm"), 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id: listingId } = await params;
  if (!UUID.test(listingId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { bookingId?: string; action?: string; checkIn?: boolean };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const bookingId = String(payload.bookingId ?? "");
  if (!UUID.test(bookingId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (payload.action !== "confirm" && payload.action !== "reject") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title, event_date, event_time, event_end_time, event_location, organizer_name")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canOperateEntrance(admin, user.id, listing))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Bokningen måste höra till DET HÄR evenemanget och fortfarande vara vilande.
  // Annars kunde en entrévärd bekräfta något annat, eller samma köp två gånger
  // (och räkna biljetten dubbelt).
  const { data: booking } = await admin
    .from("bookings")
    .select("id, customer_id, guest_name, guest_email, amount_paid, guest_count, ticket_type_id, ticket_type_name, scheduled_at, notes")
    .eq("id", bookingId)
    .eq("listing_id", listingId)
    .eq("payment_method", "swish")
    .eq("status", "pending")
    .maybeSingle();
  if (!booking) return NextResponse.json({ error: "notPending" }, { status: 409 });

  const now = new Date().toISOString();
  const service = booking.ticket_type_name ? `${listing.title} · ${booking.ticket_type_name}` : listing.title;

  if (payload.action === "reject") {
    const { error } = await admin
      .from("bookings")
      .update({ status: "canceled", notes: `${booking.notes ?? ""}\nAvvisad i entrén av ${user.id}: ingen Swish-betalning hittades`.trim() })
      .eq("id", booking.id)
      .eq("status", "pending");
    if (error) return NextResponse.json({ error: "updateFailed" }, { status: 500 });
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
    return NextResponse.json({ ok: true, status: "canceled" });
  }

  const checkIn = payload.checkIn === true;
  const { data: updated, error } = await admin
    .from("bookings")
    .update({
      status: "confirmed",
      ...(checkIn ? { checked_in_at: now, scanned_by: user.id } : {}),
      notes: `${booking.notes ?? ""}\nSwish bekräftad i entrén av ${user.id}`.trim(),
    })
    .eq("id", booking.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (error || !updated) return NextResponse.json({ error: "updateFailed" }, { status: 500 });

  const guestCount = booking.guest_count ?? 1;
  await admin
    .rpc("increment_tickets_sold", { p_listing: listing.id, p_n: guestCount, p_ticket_type: booking.ticket_type_id ?? undefined })
    .then(({ error: e }) => e && console.error("increment_tickets_sold failed (swish confirm):", e));

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

  return NextResponse.json({ ok: true, status: "confirmed", checkedIn: checkIn, emailed: !!booking.guest_email });
}
