// Förnyelse av TikToks access token.
//
// TikTok ger ett access token som lever 24h och ett refresh-token som lever
// ~365 dagar. Utan förnyelse var kopplingen död dagen efter att den skapades
// och användaren fick koppla om varje dygn. Här förnyas access-tokenet lat:
// när media faktiskt ska hämtas, om tokenet gått ut eller är på väg att göra
// det. Ingen cron behövs, och en användare som aldrig hämtar media kostar inga
// anrop.
//
// TikTok roterar refresh-tokenet vid varje förnyelse, så svaret måste sparas —
// annars fungerar nästa förnyelse inte.

import type { SupabaseClient } from "@supabase/supabase-js";
import { expiryFromExpiresIn } from "./connection-state";

const TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";

/**
 * Så nära utgången vi förnyar i förväg. Ett token som går ut mitt under
 * hämtningen ger ett 401 som användaren inte kan göra något åt.
 */
export const REFRESH_MARGIN_SECONDS = 5 * 60;

export interface TikTokTokens {
  accessToken: string | null;
  refreshToken: string | null;
  /** Access-tokenets utgång. null = okänd, vilket tvingar fram en förnyelse. */
  expiresAt: string | null;
}

/**
 * Behöver access-tokenet förnyas innan det används?
 *
 * Okänd utgång räknas som "ja": hellre en onödig förnyelse än ett anrop som
 * failar för användaren.
 */
export function needsRefresh(
  expiresAt: string | Date | null | undefined,
  now: Date = new Date(),
  marginSeconds: number = REFRESH_MARGIN_SECONDS
): boolean {
  if (expiresAt == null) return true;

  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return true;

  return expiry.getTime() - now.getTime() <= marginSeconds * 1000;
}

export type RefreshOutcome =
  | { ok: true; accessToken: string }
  /**
   * needsReconnect skiljer "TikTok vägrade, användaren måste koppla om" från
   * "det gick fel just nu, försök igen" — anroparen ska inte be någon koppla om
   * bara för att TikTok hade en dålig minut.
   */
  | { ok: false; needsReconnect: boolean; reason: string };

/**
 * Ger ett användbart access token, och förnyar först om det behövs.
 * Nya tokens sparas på raden innan de returneras.
 */
export async function getValidTikTokAccessToken(
  supabase: SupabaseClient,
  userId: string,
  tokens: TikTokTokens,
  now: Date = new Date()
): Promise<RefreshOutcome> {
  if (!tokens.accessToken) {
    return { ok: false, needsReconnect: true, reason: "not_connected" };
  }

  if (!needsRefresh(tokens.expiresAt, now)) {
    return { ok: true, accessToken: tokens.accessToken };
  }

  if (!tokens.refreshToken) {
    // Kopplingar från före förnyelsen fanns saknar refresh-token.
    return { ok: false, needsReconnect: true, reason: "no_refresh_token" };
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    // Saknad konfiguration är vårt fel, inte användarens — be inte om omkoppling.
    return { ok: false, needsReconnect: false, reason: "not_configured" };
  }

  let res: Response;
  try {
    res = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return { ok: false, needsReconnect: false, reason: "network" };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("TikTok token refresh failed:", res.status, body);
    // 4xx betyder att refresh-tokenet är återkallat eller utgånget; bara då
    // hjälper det att koppla om.
    return {
      ok: false,
      needsReconnect: res.status >= 400 && res.status < 500,
      reason: `http_${res.status}`,
    };
  }

  const data = await res.json().catch(() => null);
  const accessToken: string | undefined = data?.access_token;
  if (!accessToken) {
    console.error("TikTok token refresh response missing access_token:", data);
    return { ok: false, needsReconnect: false, reason: "malformed_response" };
  }

  const { error } = await supabase
    .from("social_connections")
    .update({
      tiktok_access_token: accessToken,
      // TikTok roterar refresh-tokenet. Faller det bort ur svaret behåller vi
      // det gamla hellre än att skriva null och göra kopplingen oförnybar.
      tiktok_refresh_token: data.refresh_token ?? tokens.refreshToken,
      tiktok_token_expires_at: expiryFromExpiresIn(data.expires_in, now),
      tiktok_refresh_token_expires_at: expiryFromExpiresIn(data.refresh_expires_in, now),
    })
    .eq("user_id", userId);

  if (error) {
    // Tokenet är giltigt men osparat. Låt anropet gå igenom nu; nästa gång
    // förnyas det igen.
    console.error("Kunde inte spara förnyat TikTok-token:", error.message);
  }

  return { ok: true, accessToken };
}
