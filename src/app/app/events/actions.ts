"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { EVENT_CATEGORIES } from "./constants";
import { getSubscriptionStatus } from "@/lib/subscription/check";
import { checkListingLimit } from "@/lib/listings/limits";
import { generateUniqueListingSlug, generateUniqueSeriesSlug } from "@/lib/listings/slug";

const BANKID_REQUIRED_MSG =
  "Du måste verifiera dig med BankID innan du kan publicera eller duplicera evenemang. Gör det under Profil.";

/**
 * Mirrors the `is_bankid_cleared()` DB function that backs the RLS WITH CHECK on
 * `listings`. Writes by an un-cleared creator are blocked by RLS and would
 * otherwise surface as a generic "kunde inte"-fel — this lets us return a clear,
 * actionable message before we even attempt the write.
 */
async function isBankidCleared(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("profiles")
    .select("role, bankid_verified_at, bankid_grandfathered_at")
    .eq("id", userId)
    .single();
  if (!data) return false;
  return (
    data.role === "customer" ||
    data.bankid_verified_at != null ||
    data.bankid_grandfathered_at != null
  );
}

/**
 * Expand a recurring event into its occurrence dates (YYYY-MM-DD), starting
 * from `start` and including it. Date math is done in UTC to avoid timezone
 * drift. `monthly` uses calendar months (overflow lands in the next month,
 * e.g. Jan 31 → Mar 3), which is acceptable for scheduling.
 */
function computeSeriesDates(start: string, interval: string, count: number): string[] {
  const [y, m, day] = start.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, day));
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    if (interval === "monthly") d.setUTCMonth(base.getUTCMonth() + i);
    else d.setUTCDate(base.getUTCDate() + i * (interval === "biweekly" ? 14 : 7));
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

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
  const eventEndTime = (formData.get("event_end_time") as string)?.trim() || null;
  const eventLatRaw = formData.get("event_lat") as string;
  const eventLngRaw = formData.get("event_lng") as string;
  const eventPlaceId = (formData.get("event_place_id") as string)?.trim() || null;
  const eventCity = (formData.get("event_city") as string)?.trim() || null;
  const eventVenue = (formData.get("event_venue") as string)?.trim() || null;
  const eventLat = eventLatRaw ? parseFloat(eventLatRaw) : null;
  const eventLng = eventLngRaw ? parseFloat(eventLngRaw) : null;
  const listingType = (formData.get("listing_type") as string) || "event";
  const openToInstructors = formData.get("open_to_instructors") === "on";
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
      event_end_time: eventEndTime,
      event_location: eventLocation,
      event_city: eventCity,
      event_venue: eventVenue,
      event_lat: eventLat,
      event_lng: eventLng,
      event_place_id: eventPlaceId,
      listing_type: listingType,
      open_to_instructors: openToInstructors,
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

  if (!(await isBankidCleared(supabase, user.id))) {
    return { error: BANKID_REQUIRED_MSG };
  }

  // Check listing limit for user's tier
  const { tier } = await getSubscriptionStatus(user.id);
  const limit = await checkListingLimit(user.id, tier);
  if (!limit.allowed) {
    return { error: `Du har nått maxgränsen (${limit.max}) för din plan. Uppgradera för att skapa fler.` };
  }

  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  // Recurring series — generate one occurrence per date (only meaningful with
  // a start date). Each occurrence is its own bookable listing.
  const recurrence = (formData.get("recurrence") as string) || "none";
  const occRaw = parseInt((formData.get("occurrences") as string) || "1", 10);
  const occurrences = Math.min(Math.max(isNaN(occRaw) ? 1 : occRaw, 1), 52);
  const isSeries = recurrence !== "none" && !!parsed.data.event_date && occurrences > 1;

  const dates: (string | null)[] = isSeries
    ? computeSeriesDates(parsed.data.event_date as string, recurrence, occurrences)
    : [parsed.data.event_date];

  // The plan limit covers the whole series, not just one row.
  if (limit.max !== null) {
    const remaining = limit.max - limit.current;
    if (dates.length > remaining) {
      return {
        error:
          remaining <= 0
            ? `Du har nått maxgränsen (${limit.max}) för din plan. Uppgradera för att skapa fler.`
            : `Din plan tillåter ${remaining} till (max ${limit.max}). Minska antalet tillfällen eller uppgradera.`,
      };
    }
  }

  // A series shares one series_id + series_slug so the occurrences can be
  // grouped on a /series/<slug> landing page.
  const seriesId = isSeries ? crypto.randomUUID() : null;
  const seriesSlug = isSeries ? await generateUniqueSeriesSlug(supabase, parsed.data.title) : null;

  // Opt-in: auto-publish each occurrence to Facebook ~3 days before its date.
  const fbAutoPost = formData.get("fb_auto_post") === "on";

  // Build one listing per date, each with its own date-based slug.
  const taken = new Set<string>();
  const rows = [];
  for (const d of dates) {
    rows.push({
      ...parsed.data,
      user_id: user.id,
      event_date: d,
      slug: await generateUniqueListingSlug(supabase, parsed.data.title, {
        dateSuffix: d ?? undefined,
        taken,
      }),
      series_id: seriesId,
      series_slug: seriesSlug,
      fb_auto_post: fbAutoPost,
    });
  }

  const { data: created, error } = await supabase
    .from("listings")
    .insert(rows)
    .select("id, title, event_date, event_location, image_url");

  if (error || !created?.length) return { error: "Kunde inte skapa evenemanget. Försök igen." };

  // Auto-post to feed — one post for the first occurrence (a series notes the rest).
  const first = created[0];
  const dateLabel = first.event_date
    ? new Date(first.event_date).toLocaleDateString("sv-SE", { day: "numeric", month: "long" })
    : null;
  const seriesNote = isSeries ? ` (+${created.length - 1} fler tillfällen)` : "";
  const text = dateLabel
    ? `Nytt event: ${first.title} — ${dateLabel}${seriesNote}${first.event_location ? ` i ${first.event_location}` : ""}. Välkommen!`
    : `Nytt event: ${first.title}${first.event_location ? ` i ${first.event_location}` : ""}. Välkommen!`;

  await supabase.from("posts").insert({
    user_id: user.id,
    text,
    image_url: first.image_url,
    listing_id: first.id,
  });

  revalidatePath("/app/events");
  revalidatePath("/app");
  revalidatePath("/app/posts");
  redirect("/app/events");
}

export async function duplicateEvent(
  sourceId: string,
  newDate: string,
  newTime: string | null,
  newEndTime: string | null
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };
  if (!newDate) return { error: "Datum krävs" };

  if (!(await isBankidCleared(supabase, user.id))) {
    return { error: BANKID_REQUIRED_MSG };
  }

  const { tier } = await getSubscriptionStatus(user.id);
  const limit = await checkListingLimit(user.id, tier);
  if (!limit.allowed) {
    return { error: `Du har nått maxgränsen (${limit.max}) för din plan. Uppgradera för att skapa fler.` };
  }

  const { data: src, error: fetchErr } = await supabase
    .from("listings")
    .select("title, description, category, price, duration_minutes, event_tier, image_url, event_location, event_lat, event_lng, event_place_id, listing_type, min_guests, max_guests, experience_details, capacity")
    .eq("id", sourceId)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !src) return { error: "Hittade inte originalet." };

  const slug = await generateUniqueListingSlug(supabase, src.title, { dateSuffix: newDate });

  const { data: cloned, error: insErr } = await supabase
    .from("listings")
    .insert({
      ...src,
      user_id: user.id,
      event_date: newDate,
      event_time: newTime,
      event_end_time: newEndTime,
      is_active: true,
      slug,
    })
    .select("id, title, event_date, event_location, image_url")
    .single();

  if (insErr || !cloned) return { error: "Kunde inte duplicera evenemanget." };

  const text = `Nytt event: ${cloned.title} — ${new Date(newDate).toLocaleDateString("sv-SE", { day: "numeric", month: "long" })}${cloned.event_location ? ` i ${cloned.event_location}` : ""}. Välkommen!`;

  await supabase.from("posts").insert({
    user_id: user.id,
    text,
    image_url: cloned.image_url,
    listing_id: cloned.id,
  });

  revalidatePath("/app/events");
  revalidatePath("/app");
  revalidatePath("/app/posts");
  return { success: true, id: cloned.id };
}

export async function updateEvent(id: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Ej inloggad" };

  if (!(await isBankidCleared(supabase, user.id))) {
    return { error: BANKID_REQUIRED_MSG };
  }

  const parsed = parseEventForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  // Backfill a slug for older events that never got one. Existing slugs are
  // left untouched so already-shared links keep working.
  const { data: current } = await supabase
    .from("listings")
    .select("slug")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (current && !current.slug) {
    updateData.slug = await generateUniqueListingSlug(supabase, parsed.data.title, {
      excludeId: id,
      dateSuffix: parsed.data.event_date ?? undefined,
    });
  }

  const { error } = await supabase
    .from("listings")
    .update(updateData)
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

// ── Instructor opt-in: offer paid mini-sessions at someone's open event ──

const INSTRUCTOR_TIERS = ["guld", "premium"];
const INSTRUCTOR_ROLES = ["creator", "kreator"];

/**
 * A paying dance-instructor creator joins an open event so they can sell
 * 15/30/45/60-minute mini-sessions there. Gating mirrors the RLS policy on
 * event_instructors, but returns clear Swedish messages first.
 */
export async function joinOpenEvent(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  if (!(await isBankidCleared(supabase, user.id))) {
    return { error: BANKID_REQUIRED_MSG };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tier, offers_coaching, coaching_hourly_rate_sek, stripe_account_id")
    .eq("id", user.id)
    .single();

  if (!profile || !INSTRUCTOR_ROLES.includes(profile.role)) {
    return { error: "Endast instruktörer (kreatörer) kan gå med." };
  }
  if (!INSTRUCTOR_TIERS.includes(profile.tier)) {
    return { error: "Du behöver en Guld- eller Premium-prenumeration för att erbjuda tjänster på event." };
  }
  if (!profile.offers_coaching || !profile.coaching_hourly_rate_sek || profile.coaching_hourly_rate_sek <= 0) {
    return { error: "Aktivera coaching och sätt ett timpris i din profil först." };
  }
  if (!profile.stripe_account_id) {
    return { error: "Anslut Stripe för att ta emot betalningar först." };
  }

  const { data: listing } = await supabase
    .from("listings")
    .select("id, is_active, open_to_instructors")
    .eq("id", listingId)
    .single();
  if (!listing || !listing.is_active || !listing.open_to_instructors) {
    return { error: "Eventet är inte öppet för instruktörer." };
  }

  const { error } = await supabase
    .from("event_instructors")
    .insert({ listing_id: listingId, instructor_id: user.id });

  if (error) {
    if (error.code === "23505") return { success: true }; // already joined — idempotent
    return { error: "Kunde inte gå med. Försök igen." };
  }

  revalidatePath("/app/events/open");
  revalidatePath(`/listing/${listingId}`);
  return { success: true };
}

/**
 * Instructor leaves an open event. Only stops NEW sales — already-sold minute
 * credits remain valid bookings the instructor still redeems.
 */
export async function leaveOpenEvent(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" };

  const { error } = await supabase
    .from("event_instructors")
    .delete()
    .eq("listing_id", listingId)
    .eq("instructor_id", user.id);

  if (error) return { error: "Kunde inte lämna eventet." };

  revalidatePath("/app/events/open");
  revalidatePath(`/listing/${listingId}`);
  return { success: true };
}
