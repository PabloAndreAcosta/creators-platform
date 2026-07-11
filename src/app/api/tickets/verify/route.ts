import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminById } from "@/lib/admin/check";
import { canScanListing } from "@/lib/scan-access";

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

  // Use admin client to bypass RLS — we verify permissions manually below
  const admin = createAdminClient();

  let bookingQuery = admin
    .from("bookings")
    .select("id, listing_id, creator_id, status, scheduled_at, notes, amount_paid, booking_type");

  // The QR encodes the FULL booking UUID as `id` — match it exactly. Only the
  // code-only path (USH-XXXXXXXX, 8 hex) needs the prefix range. Using
  // maybeSingle() (not single()) means a prefix collision or no match returns
  // cleanly instead of a PGRST116 error that showed a valid ticket as not_found.
  const isFullUuid = !!id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  if (isFullUuid) {
    bookingQuery = bookingQuery.eq("id", id!);
  } else {
    // UUID columns don't support ilike; build a UUID range covering the prefix.
    const paddedStart = idPrefix + "0".repeat(32 - idPrefix.length);
    const uuidStart = `${paddedStart.slice(0,8)}-${paddedStart.slice(8,12)}-${paddedStart.slice(12,16)}-${paddedStart.slice(16,20)}-${paddedStart.slice(20,32)}`;
    const paddedEnd = idPrefix + "f".repeat(32 - idPrefix.length);
    const uuidEnd = `${paddedEnd.slice(0,8)}-${paddedEnd.slice(8,12)}-${paddedEnd.slice(12,16)}-${paddedEnd.slice(16,20)}-${paddedEnd.slice(20,32)}`;
    bookingQuery = bookingQuery.gte("id", uuidStart).lte("id", uuidEnd);
  }

  const { data: booking, error: bookingError } = await bookingQuery.limit(1).maybeSingle();

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

  // The listing owner, an admin, or a crew member the host delegated scanning
  // to (can_scan) may verify tickets for this booking's event.
  const isOwnerOrAdmin =
    booking.creator_id === user.id || (await isAdminById(user.id));
  if (
    !isOwnerOrAdmin &&
    !(await canScanListing(admin, user.id, booking.listing_id))
  ) {
    return NextResponse.json(
      { error: "Du har inte behörighet att verifiera biljetter för det här eventet" },
      { status: 403 }
    );
  }

  // Fetch listing details
  const { data: listing } = await admin
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
