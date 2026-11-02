import { createAdminClient } from "@/lib/supabase/admin";
import { hasUtm, parseUtm } from "./utm";

/** Ett konto räknas som nytt i två dygn; därefter är kanalen inte längre dess ursprung. */
export const SIGNUP_UTM_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Ska kanalen sparas på det här kontot? Ren funktion, testbar. */
export function shouldRecordSignupUtm(userCreatedAt: string | undefined | null, cookie: string | undefined | null, now = Date.now()): boolean {
  if (!userCreatedAt || !cookie) return false;
  const age = now - Date.parse(userCreatedAt);
  return Number.isFinite(age) && age >= 0 && age < SIGNUP_UTM_WINDOW_MS && hasUtm(parseUtm(cookie));
}

/**
 * Sparar kanalen (usha_utm) på ett nytt konto, en gång. Uppdateringen
 * villkoras på att inget redan sparats, så upprepade anrop skriver inte över.
 * Fel sväljs: statistik får aldrig stoppa en inloggning.
 */
export async function recordSignupUtm(user: { id: string; created_at?: string }, cookie: string | undefined | null): Promise<void> {
  if (!shouldRecordSignupUtm(user.created_at, cookie)) return;
  const utm = parseUtm(cookie);
  try {
    await createAdminClient()
      .from("profiles")
      .update({
        signup_utm_source: utm.source ?? null,
        signup_utm_medium: utm.medium ?? null,
        signup_utm_campaign: utm.campaign ?? null,
        signup_utm_content: utm.content ?? null,
      })
      .eq("id", user.id)
      .is("signup_utm_source", null)
      .is("signup_utm_campaign", null);
  } catch {
    // tyst
  }
}
