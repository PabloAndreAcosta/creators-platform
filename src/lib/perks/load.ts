import { createAdminClient } from "@/lib/supabase/admin";
import { todayStockholm } from "@/lib/listings/time-window";
import { PERKS, type Perk } from "./catalog";
import { buildPerkOffers, type PerkCodeRow, type PerkOffer } from "./offers";

/**
 * Förmånerna som går att visa just nu. Serverkod: kodraderna skyddas av RLS
 * och läses med adminklienten, och koden släpps bara vidare när `eligible`
 * är sant. Utan förmåner görs inget databasanrop alls.
 */
export async function loadPerkOffers(eligible: boolean, perks: readonly Perk[] = PERKS): Promise<PerkOffer[]> {
  if (perks.length === 0) return [];
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("series_access_codes")
    .select("id, series_slug, code, discount_price, is_active")
    .in("id", perks.map((p) => p.accessCodeId));
  // Hellre en tom lista än ett löfte som inte går att lösa in.
  if (error || !data) return [];
  return buildPerkOffers(perks, data as PerkCodeRow[], { eligible, today: todayStockholm() });
}
