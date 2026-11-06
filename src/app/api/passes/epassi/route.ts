import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications/create";

/**
 * Kunden väljer "Betala med friskvårdsbidrag (Epassi)" på ett klippkort.
 *
 * Epassi har inget API i Sverige, så betalningen sker i Epassi-appen och vi
 * kan inte se den härifrån. Här skapas därför bara ett vilande klippkort
 * (status pending, payment_method epassi) som arrangören bekräftar på
 * /app/epassi när köpet syns i Epassis leverantörsportal. Inget pris, ingen
 * giltighetstid och inget klipp räknas förrän dess.
 *
 * Bara klippkort som är flaggade som friskvård (is_wellness_eligible) kan
 * väljas — samma kort som finns som produkter i Epassi.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Fler vilande Epassi-kort än så per kund är ett fel eller missbruk, inte ett köp. */
const MAX_PENDING_PER_CUSTOMER = 3;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "login_required" }, { status: 401 });

  let listingId: unknown;
  try {
    ({ listingId } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (typeof listingId !== "string" || !UUID.test(listingId)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title, price, listing_type, session_count, is_active, is_public, is_wellness_eligible")
    .eq("id", listingId)
    .maybeSingle();

  if (
    !listing ||
    listing.listing_type !== "package" ||
    !(listing.session_count > 0) ||
    !listing.is_active ||
    !listing.is_public ||
    !listing.is_wellness_eligible ||
    !(listing.price > 0)
  ) {
    return NextResponse.json({ error: "not_epassi_eligible" }, { status: 400 });
  }

  // Samma kund och samma kort: återanvänd den vilande bokningen i stället för
  // att skapa en ny för varje tryck.
  const { data: pending } = await admin
    .from("bookings")
    .select("id, listing_id")
    .eq("customer_id", user.id)
    .eq("payment_method", "epassi")
    .eq("status", "pending");

  const existing = (pending ?? []).find((b) => b.listing_id === listing.id);
  if (existing) {
    return NextResponse.json({ bookingId: existing.id, title: listing.title, price: listing.price });
  }
  if ((pending ?? []).length >= MAX_PENDING_PER_CUSTOMER) {
    return NextResponse.json({ error: "too_many_pending" }, { status: 429 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .maybeSingle();

  const { data: booking, error } = await admin
    .from("bookings")
    .insert({
      listing_id: listing.id,
      creator_id: listing.user_id,
      customer_id: user.id,
      status: "pending",
      booking_type: "ticket",
      scheduled_at: new Date().toISOString(),
      payment_method: "epassi",
      sessions_total: listing.session_count,
      sessions_redeemed: 0,
      platform_fee_amount: 0,
    })
    .select("id")
    .single();

  if (error || !booking) {
    console.error("Epassi: kunde inte skapa vilande klippkort", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  await createNotification({
    userId: listing.user_id,
    type: "booking_new",
    titleKey: "epassiRequestTitle",
    bodyKey: "epassiRequestMsg",
    params: {
      name: profile?.full_name || profile?.email || user.email || "?",
      service: listing.title,
    },
    link: "/app/epassi",
  });

  return NextResponse.json({ bookingId: booking.id, title: listing.title, price: listing.price });
}
