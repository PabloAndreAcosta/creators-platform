import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/config";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Du måste vara inloggad" },
      { status: 401 }
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ogiltig begäran" },
      { status: 400 }
    );
  }
  const { bookingId } = body;

  if (!bookingId) {
    return NextResponse.json(
      { error: "Boknings-ID saknas" },
      { status: 400 }
    );
  }

  // Use admin client to bypass RLS — we verify permissions manually below
  const admin = createAdminClient();

  // Fetch booking and verify the scanner is the creator of this listing
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select("id, status, creator_id, checked_in_at, listing_id, listings(title)")
    .eq("id", bookingId)
    .single();

  if (bookingError || !booking) {
    return NextResponse.json(
      { error: "Bokning hittades inte" },
      { status: 404 }
    );
  }

  // Only the creator of the listing can check in guests
  // Admin accounts can check in any ticket (for testing)
  if (!isAdmin(user.email) && booking.creator_id !== user.id) {
    return NextResponse.json(
      { error: "Bara arrangören kan registrera insläpp" },
      { status: 403 }
    );
  }

  // Already checked in
  if (booking.checked_in_at) {
    return NextResponse.json({
      success: false,
      alreadyCheckedIn: true,
      checkedInAt: booking.checked_in_at,
      title: (booking as any).listings?.title || "Bokning",
    });
  }

  // Must be confirmed to check in
  if (booking.status !== "confirmed") {
    return NextResponse.json({
      success: false,
      error: booking.status === "pending"
        ? "Bokningen är inte bekräftad ännu"
        : booking.status === "canceled"
          ? "Bokningen är avbokad"
          : "Bokningen kan inte checkas in",
      status: booking.status,
    });
  }

  // Mark as checked in and completed
  const { error: updateError } = await admin
    .from("bookings")
    .update({
      checked_in_at: new Date().toISOString(),
      status: "completed",
    })
    .eq("id", bookingId);

  if (updateError) {
    return NextResponse.json(
      { error: "Kunde inte registrera insläpp" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    title: (booking as any).listings?.title || "Bokning",
    checkedInAt: new Date().toISOString(),
  });
}
