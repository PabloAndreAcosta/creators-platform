import type { MemberTier } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

/**
 * Hur många tjänster/kvällar en nivå får ha IGÅNG samtidigt.
 *
 * Taket räknade tidigare varenda rad användaren någonsin skapat. Eftersom
 * passerade evenemang ska ligga kvar som bläddringsbart bibliotek — de
 * städas aldrig — innebar det tre kvällar TOTALT för en gratiskreatör. En
 * instruktör med en klass i veckan slog i väggen efter tre veckor och kom
 * aldrig loss igen, oavsett hur lite hen sålt.
 *
 * Det är inte en nivågräns, det är en återvändsgränd. Ett tak på vad man kör
 * just nu är ett rimligt produktbeslut; ett tak på vad man någonsin gjort
 * straffar den som återkommer.
 */
const TIER_LIMITS: Record<MemberTier, number | null> = {
  gratis: 3,
  guld: 15,
  premium: null, // obegränsat
};

interface LimitCheck {
  allowed: boolean;
  current: number;
  max: number | null;
}

/**
 * Check if a user can create another listing based on their tier.
 * Returns current count and whether they're allowed to create more.
 */
export async function checkListingLimit(
  userId: string,
  tier: MemberTier
): Promise<LimitCheck> {
  const max = TIER_LIMITS[tier];

  // Unlimited — no need to count
  if (max === null) {
    return { allowed: true, current: 0, max: null };
  }

  const supabase = await createClient();
  // Bara det som är igång räknas: aktiva rader vars kväll inte varit än, plus
  // tjänster utan datum. Passerade kvällar ligger kvar i biblioteket men tar
  // ingen plats i taket.
  const idag = new Date().toISOString().slice(0, 10);
  const { count } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_active", true)
    .or(`event_date.gte.${idag},event_date.is.null`);

  const current = count ?? 0;

  return {
    allowed: current < max,
    current,
    max,
  };
}
