import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { expiredSetCookieHeader } from "@/lib/supabase/auth-cookies";
import { locales, LOCALE_COOKIE_NAME, detectLocaleFromAcceptLanguage, isLikelyBot } from "@/i18n/config";

export async function middleware(request: NextRequest) {
  // 1. Ensure locale cookie exists. A cookieless visitor gets their device
  //    language (sv/en/es); when nothing matches, real visitors fall back to
  //    English and crawlers to Swedish (the .se site's canonical language).
  //    Same resolution as i18n/request.ts, so persisting it here doesn't lock
  //    the page to the wrong language on the second load.
  const localeCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value;
  const fallback = isLikelyBot(request.headers.get("user-agent")) ? "sv" : "en";
  const locale = locales.includes(localeCookie as (typeof locales)[number])
    ? localeCookie!
    : detectLocaleFromAcceptLanguage(request.headers.get("accept-language"), fallback);

  let response: NextResponse;
  let clearHostOnly: string[] = [];
  try {
    ({ response, clearHostOnly } = await updateSession(request));
  } catch {
    response = NextResponse.next({ request: { headers: request.headers } });
  }

  // Set locale cookie if missing or invalid
  if (!localeCookie || localeCookie !== locale) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  // Sist, efter alla cookies.set: host-only-varianten av döda auth-cookies.
  // Måste gå som rå header — Nexts cookie-jar håller en post per namn och
  // skulle annars slå ihop den med .usha.se-varianten ovan. Utan den här raden
  // överlever en gammal host-only-cookie från före domänbytet och skuggar
  // varje ny inloggning (refresh-stormen 2026-09-07).
  for (const name of clearHostOnly) {
    response.headers.append("Set-Cookie", expiredSetCookieHeader(name));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
