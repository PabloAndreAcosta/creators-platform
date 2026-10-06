import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";
import {
  isDatedEvent,
  blockingReason,
  matchTicketType,
  type MoveBlock,
} from "@/lib/bookings/move-occurrence";
import { stockholmToday } from "@/lib/time";

const MOVE_ERRORS: Record<MoveBlock, string> = {
  same_occurrence: "Biljetten ligger redan på den kvällen.",
  not_same_series: "Biljetten kan bara flyttas till en annan kväll i samma serie.",
  not_bookable: "Den kvällen är inte öppen för bokning.",
  in_the_past: "Den kvällen har redan varit.",
  no_matching_type: "Biljettypen finns inte på den kvällen.",
  sold_out: "Den kvällen är slutsåld för den biljettypen.",
};

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

    const { bookingId, newDate, newListingId } = await req.json();

    if (!bookingId || (!newDate && !newListingId)) {
      return NextResponse.json(
        { error: "Boknings-ID och nytt datum eller ny kväll krävs." },
        { status: 400 }
      );
    }

    // Fetch booking (RLS allows both creator and customer to SELECT)
    const { data: booking } = await supabase
      .from("bookings")
      .select(
        "id, creator_id, customer_id, status, listing_id, ticket_type_id, ticket_type_name, guest_count, guest_email, guest_name"
      )
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

    const { data: sourceListing } = await admin
      .from("listings")
      .select("id, title, event_date, series_id, is_active, is_public")
      .eq("id", booking.listing_id)
      .maybeSingle();

    let serviceName = sourceListing?.title || "Tjänst";
    let formattedDate: string;

    if (isDatedEvent(sourceListing)) {
      // BILJETT: kvällen bor i listings.event_date, och det är den dörren
      // läser. Att bara skriva scheduled_at (som koden gjorde förut) såg ut
      // att fungera i bokningslistan och nekades ändå i dörren — tyst, och
      // först när gästen stod där. Biljetten måste peka om till en annan kväll.
      if (!newListingId) {
        return NextResponse.json(
          { error: "Välj vilken kväll biljetten ska flyttas till." },
          { status: 400 }
        );
      }

      const { data: target } = await admin
        .from("listings")
        .select("id, title, event_date, event_time, series_id, is_active, is_public")
        .eq("id", newListingId)
        .maybeSingle();

      if (!target) {
        return NextResponse.json({ error: "Kvällen hittades inte." }, { status: 404 });
      }

      const { data: targetTypes } = await admin
        .from("ticket_types")
        .select("id, name, capacity, tickets_sold")
        .eq("listing_id", target.id);

      const qty = booking.guest_count ?? 1;
      const block = blockingReason({
        from: sourceListing!,
        to: target,
        today: stockholmToday(),
        ticketTypeName: booking.ticket_type_name ?? null,
        targetTypes: targetTypes ?? [],
        quantity: qty,
      });

      if (block) {
        return NextResponse.json({ error: MOVE_ERRORS[block] }, { status: 400 });
      }

      const newType = booking.ticket_type_name
        ? matchTicketType(booking.ticket_type_name, targetTypes ?? [])
        : null;

      const { error: moveError } = await admin
        .from("bookings")
        .update({
          listing_id: target.id,
          ...(newType ? { ticket_type_id: newType.id } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", bookingId)
        // Villkoret gör flytten idempotent: två klick i rad flyttar inte två
        // gånger, och räknarna nedan kan därför inte dubbelräknas.
        .eq("listing_id", booking.listing_id);

      if (moveError) {
        console.error("Reschedule move error:", moveError);
        return NextResponse.json({ error: "Kunde inte flytta biljetten." }, { status: 500 });
      }

      // Räknarna måste följa med, annars ser den gamla kvällen fortsatt såld
      // ut och den nya ser tom ut — och ett tak på målkvällen skulle kunna
      // överskridas av nästa köpare.
      await admin.rpc("increment_tickets_sold", {
        p_listing: booking.listing_id,
        p_n: -qty,
        p_ticket_type: booking.ticket_type_id ?? undefined,
      });
      await admin.rpc("increment_tickets_sold", {
        p_listing: target.id,
        p_n: qty,
        p_ticket_type: newType?.id ?? undefined,
      });

      serviceName = target.title || serviceName;
      formattedDate = `${target.event_date}${target.event_time ? ` kl. ${String(target.event_time).slice(0, 5)}` : ""}`;
    } else {
      // TJÄNSTEBOKNING: ingen kväll att byta, tiden bor i scheduled_at.
      if (!newDate) {
        return NextResponse.json({ error: "Nytt datum krävs." }, { status: 400 });
      }
      const parsedDate = new Date(newDate);
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Ogiltigt datumformat." }, { status: 400 });
      }
      if (parsedDate <= new Date()) {
        return NextResponse.json(
          { error: "Det nya datumet måste vara i framtiden." },
          { status: 400 }
        );
      }

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

      formattedDate = parsedDate.toLocaleDateString("sv-SE", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Stockholm",
      });
    }

    // Notify the other party. En gästbokning har ingen customer_id — biljetter
    // köps utan konto — och då finns ingen att skicka en avisering i appen till.
    // Utan den här kontrollen anropades createNotification med null, vilket
    // tyst inte nådde någon. Gästen får i stället veta av den som ombokade.
    const recipientId = isCreator ? booking.customer_id : booking.creator_id;

    if (recipientId) {
      createNotification({
        userId: recipientId,
        type: "booking_confirmed",
        titleKey: "bookingRescheduledTitle",
        bodyKey: "bookingRescheduledMsg",
        params: { service: serviceName, date: formattedDate },
        link: "/dashboard/bookings",
      }).catch((err) => console.error("Reschedule notification failed:", err));
    }

    return NextResponse.json({
      success: true,
      movedTo: formattedDate,
      // Säg till anroparen om gästen måste meddelas för hand, så UI:t kan
      // påminna i stället för att låtsas att ett mejl gått ut.
      notifiedInApp: !!recipientId,
      guestEmail: recipientId ? null : booking.guest_email ?? null,
    });
  } catch (error: any) {
    console.error("Reschedule error:", error);
    return NextResponse.json(
      { error: "Ett oväntat fel uppstod." },
      { status: 500 }
    );
  }
}
