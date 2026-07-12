import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  appleWalletConfigured,
  googleWalletConfigured,
  googleWalletSaveUrl,
  buildApplePass,
  type WalletTicket,
} from "@/lib/tickets/wallet";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Serves a wallet pass for a ticket. Public capability = the booking UUID (same
// model as /biljett/[id]). Apple → .pkpass download; Google → redirect to the
// "Save to Google Wallet" link. 404 until the provider's credentials are set.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const att = searchParams.get("att");
  const provider = searchParams.get("provider");

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: "Missing/invalid id" }, { status: 400 });
  }
  if (provider !== "apple" && provider !== "google") {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }
  if (provider === "apple" && !appleWalletConfigured()) {
    return NextResponse.json({ error: "Apple Wallet not configured" }, { status: 404 });
  }
  if (provider === "google" && !googleWalletConfigured()) {
    return NextResponse.json({ error: "Google Wallet not configured" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, status, scheduled_at, listing_id, guest_count")
    .eq("id", id)
    .maybeSingle();
  if (!booking || booking.status === "canceled") {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const { data: listing } = await admin
    .from("listings")
    .select("title, slug, event_date, event_time, event_location")
    .eq("id", booking.listing_id)
    .maybeSingle();

  let attendeeLabel: string | null = null;
  if (att && (booking.guest_count ?? 1) > 1) {
    const { data: a } = await admin
      .from("ticket_attendees")
      .select("idx, name")
      .eq("id", att)
      .eq("booking_id", booking.id)
      .maybeSingle();
    if (a) attendeeLabel = a.name || `Gäst ${a.idx} av ${booking.guest_count}`;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  const code = `USH-${booking.id.slice(0, 8).toUpperCase()}`;
  const verifyUrl = `${appUrl}/api/tickets/verify?code=${code}&id=${booking.id}${att ? `&att=${att}` : ""}`;
  const scheduled = new Date(booking.scheduled_at);
  const dateLabel = listing?.event_date
    ? new Date(listing.event_date + "T00:00").toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" })
    : scheduled.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
  const timeLabel = listing?.event_time ? listing.event_time.slice(0, 5) : null;

  const ticket: WalletTicket = {
    bookingId: booking.id,
    attendeeId: att,
    code,
    verifyUrl,
    title: listing?.title || "Event",
    dateLabel,
    timeLabel,
    location: listing?.event_location || null,
    attendeeLabel,
  };

  try {
    if (provider === "google") {
      return NextResponse.redirect(googleWalletSaveUrl(ticket));
    }
    const buf = await buildApplePass(ticket);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="usha-${booking.id.slice(0, 8)}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("wallet pass generation failed:", err);
    return NextResponse.json({ error: "Could not generate pass" }, { status: 500 });
  }
}
