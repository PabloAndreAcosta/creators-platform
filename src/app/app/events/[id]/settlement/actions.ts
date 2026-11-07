"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateShareInput } from "@/lib/settlements/share-input";
import { allowedPartnerIds } from "@/lib/settlements/partners";
import { checkVenueShareChange } from "@/lib/settlements/venue-share-lock";
import { isAdminById } from "@/lib/admin/check";

/**
 * Delningsavtalet för en kväll.
 *
 * Partnern är evenemangets kopplade lokal eller någon i kvällens crew
 * (accepterad medarrangör), till exempel en gästlärare som får en andel av
 * sin workshop. Aldrig ett fritt personval: en väljare över alla konton hade
 * exponerat konton, och mottagaren ska vara någon arrangören redan samarbetar
 * med på just den här kvällen. Högst en partner per evenemang.
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
  return { listing, admin, userId: user.id };
}

/** Lokalens standardandel i procent, eller null om lokalen inte har någon. */
async function venueDefaultPercent(
  admin: ReturnType<typeof createAdminClient>,
  venueProfileId: string | null,
): Promise<number | null> {
  if (!venueProfileId) return null;
  const { data } = await admin
    .from("venue_revenue_share_defaults")
    .select("partner_percent")
    .eq("venue_profile_id", venueProfileId)
    .maybeSingle();
  return data ? Number(data.partner_percent) : null;
}

const LOCK_MESSAGES = {
  crew: "Lokalen har ett standardavtal, så andelen kan inte flyttas till crew här. Kom överens med lokalen, så ändrar Usha avtalet.",
  lower: "Lokalens andel kan inte sänkas här. Det är lokalens villkor – kom överens med lokalen, så ändrar Usha avtalet.",
  remove: "Lokalens andel kan inte tas bort här. Det är lokalens villkor – kom överens med lokalen, så ändrar Usha avtalet.",
} as const;

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
  input: { partnerPercent: unknown; vatRate: unknown; payoutDelayDays: unknown; partnerProfileId?: unknown }
) {
  const ctx = await requireOwner(listingId);
  if ("error" in ctx) return { error: ctx.error };

  const allowed = await allowedPartnerIds(ctx.admin, ctx.listing);
  const requested = typeof input.partnerProfileId === "string" && input.partnerProfileId ? input.partnerProfileId : null;
  const partnerId = requested ?? ctx.listing.venue_profile_id ?? null;
  if (!partnerId) {
    return { error: "Koppla evenemanget till en lokal eller lägg till en medarrangör i crew först — det är någon av dem som får andelen." };
  }
  if (!allowed.has(partnerId)) {
    return { error: "Mottagaren måste vara kvällens lokal eller en medarrangör i crew." };
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

  // Går andelen till någon annan än lokalen tar det i praktiken bort lokalens
  // andel. Har lokalen ett standardavtal är det samma sak som en borttagning
  // och kräver admin — en överenskommelse med lokalen, inte arrangörens val.
  const toVenue = partnerId === ctx.listing.venue_profile_id;
  const lock = checkVenueShareChange(
    await venueDefaultPercent(ctx.admin, ctx.listing.venue_profile_id),
    toVenue ? { kind: "save", partnerPercent: parsed.value.partnerPercent } : { kind: "remove" },
    await isAdminById(ctx.userId),
  );
  if (!lock.ok) return { error: LOCK_MESSAGES[toVenue ? lock.reason : "crew"] };

  if (await hasSales(ctx.admin, listingId)) {
    return { error: "Kvällen har redan sålt biljetter. Villkoren går inte att ändra i efterhand." };
  }

  const { error } = await ctx.admin.from("event_revenue_shares").upsert(
    {
      listing_id: listingId,
      partner_profile_id: partnerId,
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

  const lock = checkVenueShareChange(
    await venueDefaultPercent(ctx.admin, ctx.listing.venue_profile_id),
    { kind: "remove" },
    await isAdminById(ctx.userId),
  );
  if (!lock.ok) return { error: LOCK_MESSAGES[lock.reason] };

  if (await hasSales(ctx.admin, listingId)) {
    return { error: "Kvällen har redan sålt biljetter. Avtalet går inte att ta bort i efterhand." };
  }

  const { error } = await ctx.admin.from("event_revenue_shares").delete().eq("listing_id", listingId);
  if (error) return { error: "Kunde inte ta bort delningsavtalet." };

  revalidatePath(`/app/events/${listingId}/settlement`);
  return {};
}
