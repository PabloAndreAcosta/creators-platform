import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Du måste vara inloggad." },
        { status: 401 }
      );
    }

    const { bookingId, newDate } = await req.json();

    if (!bookingId || !newDate) {
      return NextResponse.json(
        { error: "Boknings-ID och nytt datum krävs." },
        { status: 400 }
      );
    }

    // Validate date format and that it's in the future
    const parsedDate = new Date(newDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Ogiltigt datumformat." },
        { status: 400 }
      );
    }

    if (parsedDate <= new Date()) {
      return NextResponse.json(
        { error: "Det nya datumet måste vara i framtiden." },
        { status: 400 }
      );
    }

    // Fetch booking (RLS allows both creator and customer to SELECT)
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, creator_id, customer_id, status, listing_id")
      .eq("id", bookingId)
      .single();

    if (!booking) {
      return NextResponse.json(
        { error: "Bokningen hittades inte." },
        { status: 404 }
      );
    }

    const isCreator = booking.creator_id === user.id;
    const isCustomer = booking.customer_id === user.id;

    if (!isCreator && !isCustomer) {
      return NextResponse.json(
        { error: "Du har inte behörighet att omboka." },
        { status: 403 }
      );
    }

    if (booking.status !== "pending" && booking.status !== "confirmed") {
      return NextResponse.json(
        { error: "Bara väntande eller bekräftade bokningar kan ombokas." },
        { status: 400 }
      );
    }

    // Use admin client to bypass RLS (customers can't UPDATE bookings via RLS)
    const admin = createAdminClient();

    const { error: updateError } = await admin
      .from("bookings")
      .update({ scheduled_at: parsedDate.toISOString() })
      .eq("id", bookingId);

    if (updateError) {
      console.error("Reschedule update error:", updateError);
      return NextResponse.json(
        { error: "Kunde inte uppdatera bokningen." },
        { status: 500 }
      );
    }

    // Get listing title for notification
    const { data: listing } = await supabase
      .from("listings")
      .select("title")
      .eq("id", booking.listing_id)
      .single();

    const serviceName = listing?.title || "Tjänst";
    const formattedDate = parsedDate.toLocaleDateString("sv-SE", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Notify the other party
    const recipientId = isCreator ? booking.customer_id : booking.creator_id;

    createNotification({
      userId: recipientId,
      type: "booking_confirmed",
      title: "Bokning ombokad",
      message: `"${serviceName}" har ombokats till ${formattedDate}`,
      link: "/dashboard/bookings",
    }).catch((err) => console.error("Reschedule notification failed:", err));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Reschedule error:", error);
    return NextResponse.json(
      { error: "Ett oväntat fel uppstod." },
      { status: 500 }
    );
  }
}
