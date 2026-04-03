"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EVENT_CATEGORIES } from "./constants";
import { getSubscriptionStatus } from "@/lib/subscription/check";
import { checkListingLimit } from "@/lib/listings/limits";

function parseEventForm(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const category = formData.get("category") as string;
  const priceRaw = formData.get("price") as string;
  const durationRaw = formData.get("duration_minutes") as string;
  const eventTier = (formData.get("event_tier") as string) || null;
  const imageUrl = (formData.get("image_url") as string)?.trim() || null;
  const eventDate = (formData.get("event_date") as string)?.trim() || null;
  const eventTime = (formData.get("event_time") as string)?.trim() || null;
  const eventLocation = (formData.get("event_location") as string)?.trim() || null;
  const eventLatRaw = formData.get("event_lat") as string;
  const eventLngRaw = formData.get("event_lng") as string;
  const eventPlaceId = (formData.get("event_place_id") as string)?.trim() || null;
  const eventLat = eventLatRaw ? parseFloat(eventLatRaw) : null;
  const eventLng = eventLngRaw ? parseFloat(eventLngRaw) : null;
  const listingType = (formData.get("listing_type") as string) || "event";
  const minGuestsRaw = formData.get("min_guests") as string;
  const maxGuestsRaw = formData.get("max_guests") as string;
  const amenitiesRaw = (formData.get("amenities") as string)?.trim() || "";
  const includedRaw = (formData.get("included") as string)?.trim() || "";

  if (!title) return { error: "Titel krävs" } as const;
  if (!category || !EVENT_CATEGORIES.includes(category as (typeof EVENT_CATEGORIES)[number])) {
    return { error: "Välj en giltig kategori" } as const;
  }

  // Map form tier values to DB constraint values: '' → 'a', 'guld' → 'b', 'premium' → 'c'
  const tierMap: Record<string, string> = { guld: "b", premium: "c" };
  const dbTier = eventTier ? tierMap[eventTier] ?? "a" : "a";

  // Parse experience details
  const experienceDetails: Record<string, unknown> = {};
  if (amenitiesRaw) {
    experienceDetails.amenities = amenitiesRaw.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (includedRaw) {
    experienceDetails.included = includedRaw.split(",").map((s) => s.trim()).filter(Boolean);
  }

  const price = priceRaw ? parseInt(priceRaw, 10) : null;
  const duration_minutes = durationRaw ? parseInt(durationRaw, 10) : null;
  const min_guests = minGuestsRaw ? parseInt(minGuestsRaw, 10) : 1;
  const max_guests = maxGuestsRaw ? parseInt(maxGuestsRaw, 10) : null;

  if (price !== null && (isNaN(price) || price < 0)) {
    return { error: "Priset måste vara 0 eller högre" } as const;
  }
  if (duration_minutes !== null && (isNaN(duration_minutes) || duration_minutes <= 0)) {
    return { error: "Längden måste vara ett positivt tal" } as const;
  }
  if (isNaN(min_guests) || min_guests < 1) {
    return { error: "Minsta antal gäster måste vara minst 1" } as const;
  }
  if (max_guests !== null && (isNaN(max_guests) || max_guests < min_guests)) {
    return { error: "Max gäster måste vara lika med eller högre än min gäster" } as const;
  }

  return {
    data: {
      title,
      description: description || null,
      category,
      price,
      duration_minutes,
      event_tier: dbTier,
      image_url: imageUrl,
      event_date: eventDate,
      event_time: eventTime,
      event_location: eventLocation,
      event_lat: eventLat,
      event_lng: eventLng,
      event_place_id: eventPlaceId,
      listing_type: listingType,
      min_guests,
      max_guests,
      experience_details: experienceDetails,
    },
  } as const;
}

export async function createEvent(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  // Check listing limit for user's tier
  const { tier } = await getSubscriptionStatus(user.id);
  const limit = await checkListingLimit(user.id, tier);
  if (!limit.allowed) {
    return { error: `Du har nått maxgränsen (${limit.max}) för din plan. Uppgradera för att skapa fler.` };
  }

  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({ ...parsed.data, user_id: user.id })
    .select("id, title, price, event_date, event_location, image_url")
    .single();

  if (error || !listing) return { error: "Kunde inte skapa evenemanget. Försök igen." };

  // Auto-post to feed
  const text = parsed.data.event_date
    ? `Nytt event: ${parsed.data.title} — ${new Date(parsed.data.event_date).toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}${parsed.data.event_location ? ` i ${parsed.data.event_location}` : ""}. Välkommen!`
    : `Nytt event: ${parsed.data.title}${parsed.data.event_location ? ` i ${parsed.data.event_location}` : ""}. Välkommen!`;

  await supabase.from("posts").insert({
    user_id: user.id,
    text,
    image_url: parsed.data.image_url,
    listing_id: listing.id,
  });

  revalidatePath("/app/events");
  revalidatePath("/app");
  revalidatePath("/app/posts");
  redirect("/app/events");
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("listings")
    .update(parsed.data)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte uppdatera evenemanget. Försök igen." };

  revalidatePath("/app/events");
  redirect("/app/events");
}

export async function deleteEvent(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte ta bort evenemanget." };

  revalidatePath("/app/events");
  return { success: true };
}

export async function toggleEventActive(id: string, isActive: boolean) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("listings")
    .update({ is_active: isActive })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte ändra status." };

  revalidatePath("/app/events");
  return { success: true };
}
