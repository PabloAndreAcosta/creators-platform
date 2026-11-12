import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { stockholmLocalToUtcISO } from "@/lib/time";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/events/[id]/entry/epassi — registrera en enstaka kväll betald med
 * friskvårdsbidrag i Epassi-appen. { ticketTypeId?, guestCount?, name }
 *
 * Gästen har köpt kvällen (Epassi-produkten "Practica 17–23") i Epassi-appen
 * och visar kvittot och legitimation i dörren. Epassi har inget API, så den
 * som står i dörren registrerar köpet här. Bokningen skapas bekräftad OCH
 * incheckad med payment_method 'epassi' — samma betalsätt som klippkorten,
 * så den räknas i avräkningen på samma sätt.
 *
 * Namnet krävs: det är det som jämförs mot Epassis leverantörsportal i
 * efterhand. Bara den som får sköta entrén, bara Ushas egna evenemang och
 * bara kvällar flaggade som friskvård (is_wellness_eligible).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(getRateLimitKey(req, "entry-epassi"), 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id: listingId } = await params;
  if (!UUID.test(listingId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { ticketTypeId?: string | null; guestCount?: number; name?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const guestCount = Math.min(10, Math.max(1, Math.round(Number(payload.guestCount) || 1)));
  const name = String(payload.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "nameRequired" }, { status: 400 });

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, price, event_date, event_time, is_wellness_eligible")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canOperateEntrance(admin, user.id, listing))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: owner } = await admin.from("profiles").select("is_usha_owned_seller").eq("id", listing.user_id).maybeSingle();
  if (!owner?.is_usha_owned_seller || !listing.is_wellness_eligible) {
    return NextResponse.json({ error: "epassiUnavailable" }, { status: 400 });
  }

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
      guest_email: null,
      status: "confirmed",
      scheduled_at: scheduledAt,
      booking_type: "ticket",
      payment_method: "epassi",
      amount_paid: amountOre,
      platform_fee_amount: 0,
      guest_count: guestCount,
      ticket_type_id: ticketType?.id ?? null,
      ticket_type_name: ticketType?.name ?? null,
      checked_in_at: now.toISOString(),
      scanned_by: user.id,
      notes: `Epassi i dörren (enstaka kväll), kvitto och legitimation visade, registrerad av ${user.id}`,
    })
    .select("id")
    .single();
  if (error || !booking) {
    console.error("Epassi door booking insert failed:", error);
    return NextResponse.json({ error: "createFailed" }, { status: 500 });
  }

  await admin
    .rpc("increment_tickets_sold", { p_listing: listing.id, p_n: guestCount, p_ticket_type: ticketType?.id ?? undefined })
    .then(({ error: e }) => e && console.error("increment_tickets_sold failed (epassi):", e));

  return NextResponse.json({ id: booking.id, amountOre });
}
