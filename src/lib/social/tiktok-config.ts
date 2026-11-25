/**
 * Är TikTok-kopplingen påslagen i den här miljön?
 *
 * Nycklarna saknas än (minnet project_tiktok_blocked_on_creds), och knappen
 * gav då 500 "TikTok Client Key not configured". Regeln för låsta funktioner:
 * gråmarkera, göm aldrig. Servern avgör det här och skickar bara ett boolean
 * vidare — värdet på nyckeln lämnar aldrig servern.
 */
export function isTikTokConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.TIKTOK_CLIENT_KEY?.trim();
}

/** Dit /api/tiktok/connect skickar tillbaka besökaren när kopplingen är avstängd. */
export const TIKTOK_UNAVAILABLE_PATH = "/app/settings/connections?tiktok_error=unavailable";
