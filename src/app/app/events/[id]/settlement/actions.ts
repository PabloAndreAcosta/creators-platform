"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateShareInput } from "@/lib/settlements/share-input";

/**
 * Delningsavtalet för en kväll.
 *
 * Partnern är alltid evenemangets kopplade lokal. Ett fritt personval hade
 * krävt en väljare som exponerar konton, och det verkliga fallet är alltid
 * lokalen — vill man dela med en medarrangör finns gage-funktionen.
 */

/** Ägaren till evenemanget, eller ett felmeddelande. */
async function requireOwner(listingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Ej inloggad" as const };

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, venue_profile_id")
    .eq("id", listingId)
    .maybeSingle();

  // Bara ÄGAREN, aldrig en medarrangör eller teammedlem. Det här är pengar, och
  // pengavägarna delegeras inte — se lokalteamets princip.
  if (!listing || listing.user_id !== user.id) {
    return { error: "Du äger inte det här evenemanget." as const };
  }
  return { listing, admin };
}

/**
 * Har kvällen redan sålt biljetter?
 *
 * Att ändra procenten mitt i en försäljning ändrar vad som är skyldigt på köp
 * som redan skett. Den som verkligen behöver rätta ett misstag får höra av sig,
 * hellre än att villkoren tyst kan skifta under fötterna på motparten.
 */
async function hasSales(admin: ReturnType<typeof createAdminClient>, listingId: string) {
  const { count } = await admin
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("listing_id", listingId)
    .gt("amount_paid", 0);
  return (count ?? 0) > 0;
}

export async function saveRevenueShare(
  listingId: string,
  input: { partnerPercent: unknown; vatRate: unknown; payoutDelayDays: unknown }
) {
  const ctx = await requireOwner(listingId);
  if ("error" in ctx) return { error: ctx.error };

  if (!ctx.listing.venue_profile_id) {
    return { error: "Koppla evenemanget till en lokal först — det är lokalen som får andelen." };
  }

  const parsed = validateShareInput(input);
  if (!parsed.ok) {
    const messages = {
      percent: "Andelen måste vara ett heltal mellan 0 och 100.",
      vat: "Momssatsen måste vara mellan 0 och 100 procent.",
      delay: "Fördröjningen måste vara mellan 0 och 30 dagar.",
    } as const;
    return { error: messages[parsed.error] };
  }

  if (await hasSales(ctx.admin, listingId)) {
    return { error: "Kvällen har redan sålt biljetter. Villkoren går inte att ändra i efterhand." };
  }

  const { error } = await ctx.admin.from("event_revenue_shares").upsert(
    {
      listing_id: listingId,
      partner_profile_id: ctx.listing.venue_profile_id,
      partner_percent: parsed.value.partnerPercent,
      vat_rate: parsed.value.vatRate,
      payout_delay_days: parsed.value.payoutDelayDays,
    },
    { onConflict: "listing_id" }
  );

  if (error) {
    console.error("[revenue-share] spara:", error.message);
    return { error: "Kunde inte spara delningsavtalet." };
  }

  revalidatePath(`/app/events/${listingId}/settlement`);
  return {};
}

export async function removeRevenueShare(listingId: string) {
  const ctx = await requireOwner(listingId);
  if ("error" in ctx) return { error: ctx.error };

  if (await hasSales(ctx.admin, listingId)) {
    return { error: "Kvällen har redan sålt biljetter. Avtalet går inte att ta bort i efterhand." };
  }

  const { error } = await ctx.admin.from("event_revenue_shares").delete().eq("listing_id", listingId);
  if (error) return { error: "Kunde inte ta bort delningsavtalet." };

  revalidatePath(`/app/events/${listingId}/settlement`);
  return {};
}
