import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendBookingReminderEmail } from "@/lib/email/send-booking-reminder";
import { shouldSendEmail } from "@/lib/email/check-preferences";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * Cron job: "starts soon" reminder for confirmed bookings within the next ~2h.
 * Runs hourly. Idempotent via bookings.reminder_soon_sent_at (separate from the
 * day-before reminder), so a booking gets at most one day-before + one soon email.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Window: confirmed bookings starting within the next 2 hours.
  const now = new Date();
  const horizon = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const { data: bookings } = await admin
    .from("bookings")
    .select("id, scheduled_at, customer_id, creator_id, listing_id, guest_email, guest_name")
    .eq("status", "confirmed")
    .is("reminder_soon_sent_at", null)
    .gte("scheduled_at", now.toISOString())
    .lte("scheduled_at", horizon.toISOString());

  if (!bookings?.length) return NextResponse.json({ sent: 0 });

  let sent = 0;

  for (const b of bookings) {
    let to: string | null = null;
    let customerName = "Kund";

    if (b.customer_id) {
      if (!(await shouldSendEmail(b.customer_id, "notif_booking_confirmed"))) continue;
      const { data: cust } = await admin
        .from("profiles")
        .select("email, full_name")
        .eq("id", b.customer_id)
        .single();
      if (!cust?.email) continue;
      to = cust.email;
      customerName = cust.full_name || "Kund";
    } else if (b.guest_email) {
      to = b.guest_email;
      customerName = b.guest_name || "Gäst";
    }

    if (!to) continue;

    const { data: listing } = await admin
      .from("listings")
      .select("title, event_location, duration_minutes")
      .eq("id", b.listing_id)
      .single();
    const { data: creator } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", b.creator_id)
      .single();

    try {
      await sendBookingReminderEmail({
        to,
        customerName,
        serviceName: listing?.title || "Din bokning",
        scheduledAt: new Date(b.scheduled_at),
        creatorName: creator?.full_name || "Kreatör",
        location: listing?.event_location || undefined,
        bookingId: b.id,
        durationMinutes: listing?.duration_minutes || undefined,
        variant: "soon",
      });
      await admin
        .from("bookings")
        .update({ reminder_soon_sent_at: new Date().toISOString() })
        .eq("id", b.id);
      sent++;
    } catch (err) {
      console.error(`Booking soon-reminder failed for ${b.id}:`, err);
    }
  }

  return NextResponse.json({ sent });
}
