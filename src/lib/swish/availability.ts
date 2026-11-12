import type { SupabaseClient } from "@supabase/supabase-js";
import { formatSwishNumber, getSwishNumber, swishMessage } from "./config";

/** Det BookButton och kiosken behöver för att erbjuda Swish. */
export interface SwishOffer {
  number: string;
  formatted: string;
  /** Meddelandet gästen ser i Swish-appen: kväll + datum. */
  message: string;
}

/**
 * Får Swish erbjudas för det här evenemanget? Två villkor, båda på servern:
 * numret finns i app_config, och värden är Usha själv (pengarna landar på
 * bolagets bankkonto — för en tredje parts kväll vore det att ta emot någon
 * annans pengar). Samma regel som i dörren; eventsidan och kiosken ärver den.
 */
export async function swishOfferForListing(
  admin: SupabaseClient,
  listing: { user_id: string; title: string; event_date: string | null }
): Promise<SwishOffer | null> {
  const [{ data: owner }, number] = await Promise.all([
    admin.from("profiles").select("is_usha_owned_seller").eq("id", listing.user_id).maybeSingle(),
    getSwishNumber(admin),
  ]);
  if (!owner?.is_usha_owned_seller || !number) return null;
  return { number, formatted: formatSwishNumber(number), message: swishMessage(listing.title, listing.event_date) };
}
