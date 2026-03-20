"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { handleCapacityReached, autoPromoteFromQueue, addToQueue, getQueuePosition } from "@/lib/bookings/queue";
import { requirePaidSubscription } from "@/lib/subscription/check";
import { stripe } from "@/lib/stripe/client";
import { sendBookingConfirmationEmail, sendBookingCancellationEmail } from "@/lib/email/send-booking";
import { isGoldExclusive } from "@/lib/listings/early-bird";
import { notifyNewBooking, notifyBookingConfirmed, notifyBookingCanceled } from "@/lib/notifications/create";

export async function createBooking(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Du måste vara inloggad för att boka." };

  // Require paid subscription to create bookings
  try {
    await requirePaidSubscription();
  } catch {
    return { error: "Du behöver en Guld- eller Premium-prenumeration för att boka." };
  }

  const listing_id = formData.get("listing_id") as string;
  const creator_id = formData.get("creator_id") as string;
  const scheduled_at = formData.get("scheduled_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;
  const guestCountRaw = formData.get("guest_count") as string;
  const guest_count = guestCountRaw ? parseInt(guestCountRaw, 10) : 1;
  const special_requests = (formData.get("special_requests") as string)?.trim() || null;
  const attendeesRaw = (formData.get("attendees") as string)?.trim();
  let attendees: unknown[] = [];
  if (attendeesRaw) {
    try { attendees = JSON.parse(attendeesRaw); } catch { /* ignore */ }
  }

  if (!listing_id || !creator_id || !scheduled_at) {
    return { error: "Fyll i alla obligatoriska fält." };
  }

  if (creator_id === user.id) {
    return { error: "Du kan inte boka din egen tjänst." };
  }

  const scheduledDate = new Date(scheduled_at);
  if (scheduledDate <= new Date()) {
    return { error: "Välj ett datum i framtiden." };
  }

  // Check capacity and validate guest count
  const { data: listing } = await supabase
    .from("listings")
    .select("id, duration_minutes, release_to_gold_at, listing_type, min_guests, max_guests")
    .eq("id", listing_id)
    .single();

  // Validate guest count against listing constraints
  if (listing?.min_guests && guest_count < listing.min_guests) {
    return { error: `Minst ${listing.min_guests} gäster krävs.` };
  }
  if (listing?.max_guests && guest_count > listing.max_guests) {
    return { error: `Max ${listing.max_guests} gäster tillåtna.` };
  }

  if (listing?.duration_minutes) {
    const isFull = await handleCapacityReached(listing_id, listing.duration_minutes);
    if (isFull) {
      return { error: "Denna tjänst är fullbokad." };
    }
  }

  // Early bird: block gratis users during Gold-exclusive window
  if (listing?.release_to_gold_at) {
    const releaseDate = new Date(listing.release_to_gold_at);
    if (isGoldExclusive(releaseDate)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tier")
        .eq("id", user.id)
        .single();
      const tier = profile?.tier ?? "gratis";
      if (tier !== "guld" && tier !== "premium") {
        const hours = Math.ceil((releaseDate.getTime() - Date.now()) / (60 * 60 * 1000));
        return { error: `Detta event är exklusivt för Guld/Premium-medlemmar i ${hours} timmar till.` };
      }
    }
  }

  const { error } = await supabase.from("bookings").insert({
    listing_id,
    creator_id,
    customer_id: user.id,
    scheduled_at: scheduledDate.toISOString(),
    notes,
    guest_count,
    special_requests,
    attendees,
  });

  if (error) {
    return { error: "Kunde inte skapa bokningen. Försök igen." };
  }

  // Send booking confirmation email (non-blocking)
  sendBookingNotification({
    supabase,
    customerEmail: user.email!,
    customerId: user.id,
    creatorId: creator_id,
    listingId: listing_id,
    scheduledAt: scheduledDate,
  }).catch(err => console.error("Email send failed:", err));

  // In-app notification for the creator (non-blocking)
  const { data: listingData } = await supabase.from("listings").select("title").eq("id", listing_id).single();
  const { data: customerProfile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
  notifyNewBooking(
    creator_id,
    customerProfile?.full_name || "En användare",
    listingData?.title || "Tjänst"
  ).catch(err => console.error("Notification failed:", err));

  revalidatePath("/dashboard/bookings");
  return { success: true };
}

export async function updateBookingStatus(
  bookingId: string,
  status: "confirmed" | "canceled" | "completed"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  // Verify the user is the creator or customer of this booking
  const { data: booking } = await supabase
    .from("bookings")
    .select("creator_id, customer_id, status, listing_id, scheduled_at, stripe_payment_id, amount_paid")
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Bokning hittades inte." };

  const isCreator = booking.creator_id === user.id;
  const isCustomer = booking.customer_id === user.id;

  // Only creators can confirm/complete, both can cancel
  if (status === "confirmed" || status === "completed") {
    if (!isCreator) return { error: "Bara skaparen kan bekräfta bokningar." };
  }
  if (status === "canceled") {
    if (!isCreator && !isCustomer)
      return { error: "Du har inte behörighet att avboka." };
  }

  // Can only transition from valid states
  if (status === "confirmed" && booking.status !== "pending") {
    return { error: "Kan bara bekräfta väntande bokningar." };
  }
  if (status === "completed" && booking.status !== "confirmed") {
    return { error: "Kan bara slutföra bekräftade bokningar." };
  }
  if (
    status === "canceled" &&
    booking.status !== "pending" &&
    booking.status !== "confirmed"
  ) {
    return { error: "Denna bokning kan inte avbokas." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", bookingId);

  if (error) return { error: "Kunde inte uppdatera bokningen." };

  // Send email notifications (non-blocking)
  const { data: bookingListing } = await supabase.from("listings").select("title").eq("id", booking.listing_id).single();
  const serviceName = bookingListing?.title || "Tjänst";

  if (status === "confirmed") {
    sendConfirmNotification({
      supabase,
      customerId: booking.customer_id,
      creatorId: booking.creator_id,
      listingId: booking.listing_id,
      scheduledAt: new Date(booking.scheduled_at),
    }).catch(err => console.error("Confirmation email failed:", err));

    notifyBookingConfirmed(booking.customer_id, serviceName)
      .catch(err => console.error("Confirm notification failed:", err));
  } else if (status === "canceled") {
    sendCancelNotification({
      supabase,
      customerId: booking.customer_id,
      creatorId: booking.creator_id,
      listingId: booking.listing_id,
      scheduledAt: new Date(booking.scheduled_at),
    }).catch(err => console.error("Cancellation email failed:", err));

    // Notify both parties
    notifyBookingCanceled(booking.customer_id, serviceName)
      .catch(err => console.error("Cancel notification failed:", err));
    notifyBookingCanceled(booking.creator_id, serviceName)
      .catch(err => console.error("Cancel notification failed:", err));
  }

  // Auto-refund paid bookings on cancellation
  if (status === "canceled" && booking.stripe_payment_id && booking.amount_paid) {
    try {
      await stripe.refunds.create({
        payment_intent: booking.stripe_payment_id,
      });
      console.log(`Refunded payment ${booking.stripe_payment_id} for booking ${bookingId}`);
    } catch (err) {
      console.error("Auto-refund failed:", err);
    }
  }

  // When a booking is canceled, try to promote the next person in the queue
  if (status === "canceled") {
    const { data: canceledBooking } = await supabase
      .from("bookings")
      .select("listing_id")
      .eq("id", bookingId)
      .single();

    if (canceledBooking?.listing_id) {
      try {
        await autoPromoteFromQueue(canceledBooking.listing_id);
      } catch (err) {
        // booking_queue table may not exist yet — log and continue
        console.error("autoPromoteFromQueue failed (queue table may not exist):", err);
      }
    }
  }

  revalidatePath("/dashboard/bookings");
  return { success: true };
}

// ── Email helper functions ──────────────────────────────────────

interface EmailContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  customerId: string;
  creatorId: string;
  listingId: string;
  scheduledAt: Date;
  customerEmail?: string;
}

async function fetchEmailData(ctx: EmailContext) {
  const [customerResult, creatorResult, listingResult] = await Promise.all([
    ctx.supabase.from("profiles").select("email, full_name").eq("id", ctx.customerId).single(),
    ctx.supabase.from("profiles").select("email, full_name").eq("id", ctx.creatorId).single(),
    ctx.supabase.from("listings").select("title").eq("id", ctx.listingId).single(),
  ]);
  return {
    customerEmail: ctx.customerEmail || customerResult.data?.email,
    customerName: customerResult.data?.full_name || "Kund",
    creatorEmail: creatorResult.data?.email,
    creatorName: creatorResult.data?.full_name || "Kreatör",
    serviceName: listingResult.data?.title || "Tjänst",
  };
}

async function sendBookingNotification(ctx: EmailContext) {
  const data = await fetchEmailData(ctx);
  if (!data.customerEmail) return;
  await sendBookingConfirmationEmail({
    to: data.customerEmail,
    customerName: data.customerName,
    serviceName: data.serviceName,
    scheduledAt: ctx.scheduledAt,
    creatorName: data.creatorName,
  });
}

async function sendConfirmNotification(ctx: EmailContext) {
  const data = await fetchEmailData(ctx);
  if (!data.customerEmail) return;
  await sendBookingConfirmationEmail({
    to: data.customerEmail,
    customerName: data.customerName,
    serviceName: data.serviceName,
    scheduledAt: ctx.scheduledAt,
    creatorName: data.creatorName,
  });
}

async function sendCancelNotification(ctx: EmailContext) {
  const data = await fetchEmailData(ctx);
  const sends: Promise<void>[] = [];
  if (data.customerEmail) {
    sends.push(sendBookingCancellationEmail({
      to: data.customerEmail,
      recipientName: data.customerName,
      serviceName: data.serviceName,
      scheduledAt: ctx.scheduledAt,
    }));
  }
  if (data.creatorEmail) {
    sends.push(sendBookingCancellationEmail({
      to: data.creatorEmail,
      recipientName: data.creatorName,
      serviceName: data.serviceName,
      scheduledAt: ctx.scheduledAt,
    }));
  }
  await Promise.all(sends);
}

// ── Queue actions ───────────────────────────────────────────────

export async function joinQueue(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Du måste vara inloggad." };

  // Get user tier for priority placement
  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  try {
    const result = await addToQueue(listingId, user.id, profile?.tier ?? null);
    return {
      success: true,
      queuePosition: result.queuePosition,
      estimatedTime: result.estimatedTime,
    };
  } catch {
    return { error: "Kunde inte gå med i kön. Försök igen." };
  }
}

export async function getMyQueuePosition(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { position: null };

  const position = await getQueuePosition(listingId, user.id);
  return { position };
}
