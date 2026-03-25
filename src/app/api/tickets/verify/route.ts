import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const id = searchParams.get("id");

  if (!code && !id) {
    return NextResponse.json(
      { error: "Saknar kod eller id-parameter" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  // Require authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Du måste vara inloggad för att verifiera biljetter" },
      { status: 401 }
    );
  }

  // Extract booking ID prefix: from code "USH-XXXXXXXX" take the 8 hex chars,
  // or use the id param directly (first 8 chars of the booking UUID)
  let idPrefix: string;
  if (id) {
    idPrefix = id.slice(0, 8).toLowerCase();
  } else if (code) {
    const match = code.match(/^USH-([A-Fa-f0-9]{8})$/i);
    if (!match) {
      return NextResponse.json({
        valid: false,
        status: "not_found",
        ticket: {
          code: code || "",
          title: "Okänd",
          date: "",
          time: null,
          location: null,
        },
      });
    }
    idPrefix = match[1].toLowerCase();
  } else {
    idPrefix = "";
  }

  // Search for booking where id starts with the prefix
  const { data: booking, error: bookingError } = await supabase
    .from("bookings")
    .select(
      "id, listing_id, creator_id, status, scheduled_at, notes, amount_paid, booking_type"
    )
    .ilike("id", `${idPrefix}%`)
    .limit(1)
    .single();

  const ticketCode = code || `USH-${idPrefix.toUpperCase()}`;

  if (bookingError || !booking) {
    return NextResponse.json({
      valid: false,
      status: "not_found",
      ticket: {
        code: ticketCode,
        title: "Okänd",
        date: "",
        time: null,
        location: null,
      },
    });
  }

  // Only the creator/organizer of this booking can verify tickets
  if (booking.creator_id !== user.id) {
    return NextResponse.json(
      { error: "Bara arrangören kan verifiera biljetter" },
      { status: 403 }
    );
  }

  // Fetch listing details
  const { data: listing } = await supabase
    .from("listings")
    .select("title, event_date, event_time, event_location")
    .eq("id", booking.listing_id)
    .single();

  // Determine date and time display values
  const scheduledDate = new Date(booking.scheduled_at);
  let displayDate: string;
  let displayTime: string | null;

  if (listing?.event_date) {
    displayDate = new Date(listing.event_date + "T00:00").toLocaleDateString(
      "sv-SE",
      { day: "numeric", month: "long", year: "numeric" }
    );
  } else {
    displayDate = scheduledDate.toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (listing?.event_time) {
    displayTime = (listing.event_time as string).slice(0, 5);
  } else {
    displayTime = scheduledDate.toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const displayLocation = listing?.event_location || null;
  const title = listing?.title || "Okänd bokning";

  // Determine validity based on booking status
  let valid: boolean;
  let status: string;

  switch (booking.status) {
    case "confirmed":
      valid = true;
      status = "confirmed";
      break;
    case "completed":
      valid = false;
      status = "already_used";
      break;
    case "canceled":
      valid = false;
      status = "canceled";
      break;
    case "pending":
      valid = false;
      status = "pending";
      break;
    default:
      valid = false;
      status = "unknown";
      break;
  }

  return NextResponse.json({
    valid,
    status,
    bookingId: booking.id,
    ticket: {
      code: `USH-${booking.id.slice(0, 8).toUpperCase()}`,
      title,
      date: displayDate,
      time: displayTime,
      location: displayLocation,
    },
  });
}
