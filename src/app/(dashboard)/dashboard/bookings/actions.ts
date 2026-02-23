"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { handleCapacityReached, autoPromoteFromQueue } from "@/lib/bookings/queue";

export async function createBooking(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Du måste vara inloggad för att boka." };

  const listing_id = formData.get("listing_id") as string;
  const creator_id = formData.get("creator_id") as string;
  const scheduled_at = formData.get("scheduled_at") as string;
  const notes = (formData.get("notes") as string)?.trim() || null;

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

  // Check capacity if the listing has a duration_minutes field (used as max capacity)
  const { data: listing } = await supabase
    .from("listings")
    .select("id, duration_minutes")
    .eq("id", listing_id)
    .single();

  if (listing?.duration_minutes) {
    const isFull = await handleCapacityReached(listing_id, listing.duration_minutes);
    if (isFull) {
      return { error: "Denna tjänst är fullbokad." };
    }
  }

  const { error } = await supabase.from("bookings").insert({
    listing_id,
    creator_id,
    customer_id: user.id,
    scheduled_at: scheduledDate.toISOString(),
    notes,
  });

  if (error) {
    return { error: "Kunde inte skapa bokningen. Försök igen." };
  }

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
    .select("creator_id, customer_id, status")
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
