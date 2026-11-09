import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getSwishNumber } from "@/lib/swish/config";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking";
import { stockholmLocalToUtcISO } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/events/[id]/entry/swish — registrera en Swish-betalning i dörren.
 * { ticketTypeId?, guestCount?, name?, email? }
 *
 * Gästen har swishat och visat kvittot; den som står i dörren trycker
 * Registrera. Bokningen skapas bekräftad OCH incheckad — gästen står ju där —
 * med payment_method 'swish', så avräkningen vet att pengarna ligger på
 * banken och inte hos Stripe. Mejl med biljett/kvitto om en adress angavs.
 *
 * Det här är en pengahandling på Ushas konto: bara den som får sköta entrén
 * (ägare, admin, crew med can_scan) och bara för Ushas egna evenemang.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(getRateLimitKey(req, "entry-swish"), 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id: listingId } = await params;
  if (!UUID.test(listingId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { ticketTypeId?: string | null; guestCount?: number; name?: string; email?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const guestCount = Math.min(10, Math.max(1, Math.round(Number(payload.guestCount) || 1)));
  const name = String(payload.name ?? "").trim().slice(0, 120) || null;
  const emailRaw = String(payload.email ?? "").trim().toLowerCase();
  const email = emailRaw && EMAIL.test(emailRaw) ? emailRaw.slice(0, 254) : null;
  if (emailRaw && !email) return NextResponse.json({ error: "invalidEmail" }, { status: 400 });

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title, price, event_date, event_time, event_end_time, event_location, organizer_name")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canOperateEntrance(admin, user.id, listing))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: owner }, number] = await Promise.all([
    admin.from("profiles").select("is_usha_owned_seller, company_name, org_number, full_name").eq("id", listing.user_id).maybeSingle(),
    getSwishNumber(admin),
  ]);
  if (!owner?.is_usha_owned_seller || !number) return NextResponse.json({ error: "swishUnavailable" }, { status: 400 });

  let ticketType: { id: string; name: string; price: number } | null = null;
  if (payload.ticketTypeId) {
    if (!UUID.test(payload.ticketTypeId)) return NextResponse.json({ error: "Unknown ticket type" }, { status: 400 });
    const { data: tt } = await admin.from("ticket_types").select("id, name, price").eq("id", payload.ticketTypeId).eq("listing_id", listingId).maybeSingle();
    if (!tt) return NextResponse.json({ error: "Unknown ticket type" }, { status: 400 });
    ticketType = tt as { id: string; name: string; price: number };
  }
  const unit = ticketType ? Number(ticketType.price) : Number(listing.price) || 0;
  if (unit <= 0) return NextResponse.json({ error: "noPrice" }, { status: 400 });
  const amountOre = Math.round(unit * 100) * guestCount;

  const now = new Date();
  const scheduledAt =
    (listing.event_date && stockholmLocalToUtcISO(`${listing.event_date}T${listing.event_time ?? "00:00:00"}`)) || now.toISOString();

  const { data: booking, error } = await admin
    .from("bookings")
    .insert({
      listing_id: listing.id,
      creator_id: listing.user_id,
      customer_id: null,
      guest_name: name,
      guest_email: email,
      status: "confirmed",
      scheduled_at: scheduledAt,
      booking_type: "ticket",
      payment_method: "swish",
      amount_paid: amountOre,
      platform_fee_amount: 0,
      guest_count: guestCount,
      ticket_type_id: ticketType?.id ?? null,
      ticket_type_name: ticketType?.name ?? null,
      checked_in_at: now.toISOString(),
      scanned_by: user.id,
      notes: `Swish i dörren, registrerad av ${user.id}`,
    })
    .select("id")
    .single();
  if (error || !booking) {
    console.error("Swish booking insert failed:", error);
    return NextResponse.json({ error: "createFailed" }, { status: 500 });
  }

  await admin
    .rpc("increment_tickets_sold", { p_listing: listing.id, p_n: guestCount, p_ticket_type: ticketType?.id ?? undefined })
    .then(({ error: e }) => e && console.error("increment_tickets_sold failed (swish):", e));

  if (email) {
    const endIso = listing.event_date && listing.event_end_time ? stockholmLocalToUtcISO(`${listing.event_date}T${listing.event_end_time}`) : null;
    sendBookingConfirmationEmail({
      to: email,
      customerName: name || "Gäst",
      serviceName: ticketType ? `${listing.title} · ${ticketType.name}` : listing.title,
      scheduledAt: new Date(scheduledAt),
      scheduledEndAt: endIso ? new Date(endIso) : undefined,
      creatorName: listing.organizer_name || owner.full_name || "Usha",
      location: listing.event_location || undefined,
      bookingId: booking.id,
      seller: { name: owner.company_name || owner.full_name || "Usha AB", orgNumber: owner.org_number ?? undefined },
      amountOre,
    }).catch((e) => console.error("Swish confirmation email failed:", e));
  }

  return NextResponse.json({ id: booking.id, amountOre, emailed: !!email });
}
