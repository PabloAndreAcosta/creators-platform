import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmail, normalizeEmail, cleanName } from "@/lib/waitlist";
import { sendBookingConfirmationEmail } from "@/lib/email/send-booking";

// Redeem an event access code (team / VIP) for a FREE ticket. Works for
// logged-in users and guests (email required). Redemption is atomic so a code's
// max_uses can never be exceeded even under concurrency.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const te = await getTranslations("eventErrors");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let body: { code?: unknown; email?: unknown; name?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: te("generic") }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: te("codeRequired") }, { status: 400 });

  const email = user?.email ?? (isValidEmail(body.email) ? normalizeEmail(body.email) : null);
  if (!email) return NextResponse.json({ error: te("invalidEmail") }, { status: 400 });
  const name = cleanName(body.name);

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title, event_date, event_time")
    .eq("id", listingId)
    .eq("is_active", true)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: te("eventNotFound") }, { status: 404 });

  // Atomically consume one use if the code is valid + available.
  const { data: codeId, error: rpcErr } = await admin.rpc("redeem_access_code", {
    p_listing: listingId,
    p_code: code,
  });
  if (rpcErr || !codeId) {
    return NextResponse.json({ error: te("invalidCode") }, { status: 400 });
  }

  const scheduledAt = listing.event_date
    ? new Date(`${listing.event_date}T${listing.event_time || "00:00:00"}`).toISOString()
    : new Date().toISOString();

  const { error: bookErr } = await admin.from("bookings").insert({
    listing_id: listing.id,
    creator_id: listing.user_id,
    status: "confirmed",
    scheduled_at: scheduledAt,
    booking_type: "ticket",
    amount_paid: 0,
    ...(user ? { customer_id: user.id } : { guest_email: email, guest_name: name }),
  });
  if (bookErr) {
    console.error("access-code booking failed:", bookErr);
    return NextResponse.json({ error: te("generic") }, { status: 500 });
  }

  await admin.rpc("increment_tickets_sold", { p_listing: listingId, p_n: 1 });

  // Confirmation email (non-blocking; the free ticket is already booked).
  const { data: creator } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", listing.user_id)
    .maybeSingle();
  sendBookingConfirmationEmail({
    to: email,
    customerName: name || "",
    serviceName: listing.title,
    scheduledAt: new Date(scheduledAt),
    creatorName: creator?.full_name || "Usha Platform",
  }).catch((e) => console.error("access-code confirmation email failed:", e));

  return NextResponse.json({ ok: true });
}
