import type { SupabaseClient } from "@supabase/supabase-js";
import { BETA_MODE } from "@/lib/beta";
import { userIsPremium } from "@/lib/matching/access";

/**
 * Kioskläget i dörren är en Premium-funktion.
 *
 * Grinden sitter på VÄRDENS nivå, inte på den som står i dörren: plattan
 * loggas in med ett dörrkonto eller en crew-medlem, men det är arrangören
 * som betalar för Premium. Under betan är allt öppet (BETA_MODE), och då
 * säger `beta` till ytan att visa "Premium-funktion – fri under lansering"
 * i stället för ett lås.
 */
export interface KioskAccess {
  /** Får kioskläget användas för det här evenemanget just nu. */
  allowed: boolean;
  /** Värden har Premium på riktigt (inte bara betan). */
  premium: boolean;
  /** Öppet tack vare betan, inte tack vare Premium. */
  beta: boolean;
}

export async function kioskAccessForOwner(admin: SupabaseClient, ownerId: string): Promise<KioskAccess> {
  const premium = await userIsPremium(admin, ownerId);
  const beta = !premium && BETA_MODE;
  return { allowed: premium || beta, premium, beta };
}
