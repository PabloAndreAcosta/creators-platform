import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Är välkomstavdraget (50 kr till nya konton) på?
 *
 * Styrs av `signup_credit_enabled` i app_config — samma värde läser triggern
 * handle_new_user när den avgör om ett nytt konto ska få avdraget. Texterna
 * som lovar avdraget (registreringen, köpknappen, prissidan) frågar här, så
 * att löftet och utdelningen aldrig kan säga olika saker. Saknas raden är
 * svaret nej: hellre inget löfte än ett som inte hålls.
 *
 * De som redan fått avdraget behåller det oavsett — det här gäller nya konton.
 */
const TTL_MS = 5 * 60_000;
let cached: { value: boolean; at: number } | null = null;

export async function getSignupCreditEnabled(): Promise<boolean> {
  const now = Date.now();
  if (cached && now - cached.at < TTL_MS) return cached.value;
  let value = false;
  try {
    const { data } = await createAdminClient()
      .from("app_config")
      .select("value")
      .eq("key", "signup_credit_enabled")
      .maybeSingle();
    value = data?.value === true;
  } catch {
    // läsfel → inget löfte
  }
  cached = { value, at: now };
  return value;
}
