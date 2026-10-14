/**
 * Siffran på appikonen.
 *
 * Badging API finns bara när appen är installerad på hemskärmen — i en vanlig
 * webbläsarflik finns ingen ikon att märka. Den saknas också helt i äldre
 * Safari och i alla skrivbordsflikar. Därför är varje anrop här tyst: kan
 * siffran inte sättas händer ingenting, och inget kastas vidare till
 * anroparen. En notisräknare får aldrig vara det som kraschar appen.
 */

/** Högsta tal vi skickar vidare. Plattformarna visar ändå bara ett fåtal siffror. */
export const BADGE_MAX = 99;

export interface BadgeTarget {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
}

/**
 * Vad som faktiskt ska göras för ett givet antal olästa.
 *
 * Noll betyder rensa, inte "sätt siffran 0" — en nolla ritad på ikonen vore
 * fel, användaren har ju inget att se. Negativa och trasiga värden behandlas
 * som noll hellre än att skickas vidare till plattformen.
 */
export function badgeAction(unread: number): { action: "set"; count: number } | { action: "clear" } {
  if (!Number.isFinite(unread) || unread <= 0) return { action: "clear" };
  return { action: "set", count: Math.min(Math.floor(unread), BADGE_MAX) };
}

/** True när plattformen kan märka ikonen. */
export function badgeSupported(target: BadgeTarget | undefined | null): boolean {
  return typeof target?.setAppBadge === "function" && typeof target?.clearAppBadge === "function";
}

/**
 * Sätter eller rensar siffran. Returnerar vad som gjordes, vilket testerna
 * läser av — och som gör det möjligt att logga utan att gissa.
 */
export async function applyBadge(
  unread: number,
  target: BadgeTarget | undefined | null
): Promise<"set" | "cleared" | "unsupported" | "failed"> {
  if (!badgeSupported(target)) return "unsupported";
  const plan = badgeAction(unread);
  try {
    if (plan.action === "clear") {
      await target!.clearAppBadge!();
      return "cleared";
    }
    await target!.setAppBadge!(plan.count);
    return "set";
  } catch {
    // Safari kastar i privat läge och vid vissa behörighetslägen.
    return "failed";
  }
}

/** Bekvämlighet för klientkod: använder navigator när den finns. */
export function syncAppBadge(unread: number): Promise<"set" | "cleared" | "unsupported" | "failed"> {
  const nav = typeof navigator === "undefined" ? null : (navigator as unknown as BadgeTarget);
  return applyBadge(unread, nav);
}
