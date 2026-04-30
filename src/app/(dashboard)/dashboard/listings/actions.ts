"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePaidSubscription, getSubscriptionStatus } from "@/lib/subscription/check";
import { checkListingLimit } from "@/lib/listings/limits";

const CATEGORIES = ["dance", "music", "photo", "video", "design", "yoga", "fitness", "other"] as const;
const VALID_LISTING_TYPES = [
  "service",
  "event",
  "table_reservation",
  "spa_treatment",
  "group_activity",
  "dance_package",
  "coaching_session",
  "b2b_offering",
] as const;
type ListingType = (typeof VALID_LISTING_TYPES)[number];

function parseListingForm(formData: FormData) {
  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim();
  const category = formData.get("category") as string;
  const priceRaw = formData.get("price") as string;
  const durationRaw = formData.get("duration_minutes") as string;
  const imageUrl = (formData.get("image_url") as string)?.trim() || null;
  const eventDate = (formData.get("event_date") as string)?.trim() || null;
  const eventTime = (formData.get("event_time") as string)?.trim() || null;
  const eventLocation = (formData.get("event_location") as string)?.trim() || null;
  const eventEndTime = (formData.get("event_end_time") as string)?.trim() || null;
  const eventLatRaw = formData.get("event_lat") as string;
  const eventLngRaw = formData.get("event_lng") as string;
  const eventPlaceId = (formData.get("event_place_id") as string)?.trim() || null;
  const eventLat = eventLatRaw ? parseFloat(eventLatRaw) : null;
  const eventLng = eventLngRaw ? parseFloat(eventLngRaw) : null;
  const listingTypeRaw = (formData.get("listing_type") as string)?.trim();
  const listing_type: ListingType = VALID_LISTING_TYPES.includes(listingTypeRaw as ListingType)
    ? (listingTypeRaw as ListingType)
    : "service";

  if (!title) return { error: "Titel krävs" } as const;
  if (!category || !CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return { error: "Välj en giltig kategori" } as const;
  }

  const price = priceRaw ? parseInt(priceRaw, 10) : null;
  const duration_minutes = durationRaw ? parseInt(durationRaw, 10) : null;

  if (price !== null && (isNaN(price) || price < 0)) {
    return { error: "Priset måste vara 0 eller högre" } as const;
  }
  if (duration_minutes !== null && (isNaN(duration_minutes) || duration_minutes <= 0)) {
    return { error: "Längden måste vara ett positivt tal" } as const;
  }

  return {
    data: {
      title,
      description: description || null,
      category,
      price,
      duration_minutes,
      image_url: imageUrl,
      event_date: eventDate,
      event_time: eventTime,
      event_end_time: eventEndTime,
      event_location: eventLocation,
      event_lat: eventLat,
      event_lng: eventLng,
      event_place_id: eventPlaceId,
      listing_type,
    },
  } as const;
}

export async function createListing(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  // Require paid subscription to create listings
  try {
    await requirePaidSubscription();
  } catch {
    return { error: "Du behöver en Guld- eller Premium-prenumeration för att skapa tjänster." };
  }

  // Check listing limit for user's tier
  const { tier } = await getSubscriptionStatus(user.id);
  const limit = await checkListingLimit(user.id, tier);
  if (!limit.allowed) {
    return { error: `Du har nått maxgränsen (${limit.max}) för din plan. Uppgradera för att skapa fler.` };
  }

  const parsed = parseListingForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  // Only taxi_dancer creators can publish dance_package / coaching_session listings.
  // Forge-attempt fallback: silently downgrade to 'service'.
  let resolvedListingType: ListingType = parsed.data.listing_type;
  if (
    resolvedListingType === "dance_package" ||
    resolvedListingType === "coaching_session" ||
    resolvedListingType === "b2b_offering"
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("creator_subcategory")
      .eq("id", user.id)
      .single();
    if ((profile as { creator_subcategory?: string | null } | null)?.creator_subcategory !== "taxi_dancer") {
      resolvedListingType = "service";
    }
  }

  const { data: listing, error } = await supabase
    .from("listings")
    .insert({ ...parsed.data, listing_type: resolvedListingType, user_id: user.id })
    .select("id, title, price, image_url")
    .single();

  if (error || !listing) return { error: "Kunde inte skapa tjänsten. Försök igen." };

  // Auto-post to feed
  const priceText = parsed.data.price ? ` — ${parsed.data.price} kr` : "";
  await supabase.from("posts").insert({
    user_id: user.id,
    text: `Ny tjänst: ${parsed.data.title}${priceText}. Boka direkt via min profil!`,
    image_url: parsed.data.image_url,
    listing_id: listing.id,
  });

  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard");
  revalidatePath("/app");
  revalidatePath("/app/posts");
  redirect("/dashboard/listings");
}

export async function updateListing(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  try {
    await requirePaidSubscription();
  } catch {
    return { error: "Du behöver en Guld- eller Premium-prenumeration för att redigera tjänster." };
  }

  const parsed = parseListingForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  let resolvedListingType: ListingType = parsed.data.listing_type;
  if (
    resolvedListingType === "dance_package" ||
    resolvedListingType === "coaching_session" ||
    resolvedListingType === "b2b_offering"
  ) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("creator_subcategory")
      .eq("id", user.id)
      .single();
    if ((profile as { creator_subcategory?: string | null } | null)?.creator_subcategory !== "taxi_dancer") {
      resolvedListingType = "service";
    }
  }

  const { error } = await supabase
    .from("listings")
    .update({ ...parsed.data, listing_type: resolvedListingType })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Kunde inte uppdatera tjänsten. Försök igen." };

  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard");
  redirect("/dashboard/listings");
}

export async function deleteListing(id: string) {
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

  if (error) return { error: "Kunde inte ta bort tjänsten." };

  revalidatePath("/dashboard/listings");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function toggleListingActive(id: string, isActive: boolean) {
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

  revalidatePath("/dashboard/listings");
  return { success: true };
}
