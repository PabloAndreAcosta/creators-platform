import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
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
  try {
    response = await updateSession(request);
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

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
