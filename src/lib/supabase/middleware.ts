import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sharedCookieOptions } from "./cookie-options";
import { authCookieNamesFrom, expiredCookieVariants } from "./auth-cookies";

function isValidBase64URL(str: string): boolean {
  try {
    // Try to decode base64url — if it fails, the cookie is corrupt
    atob(str.replace(/-/g, "+").replace(/_/g, "/"));
    return true;
  } catch {
    return false;
  }
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  // Skip if env vars are missing (e.g. during build)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: sharedCookieOptions,
      cookies: {
        get(name: string) {
          const value = request.cookies.get(name)?.value;
          // Skip corrupt cookies to prevent Invalid UTF-8 sequence errors.
          // Only validate the UNCHUNKED, base64-prefixed session cookie:
          //  - the "base64-" prefix is not itself base64, so validate value.slice(7)
          //  - chunk cookies (name ".0", ".1", …) hold base64 *fragments* that are
          //    not independently decodable — validating them drops valid large
          //    sessions (combineChunks stops at the first missing chunk)
          //  - other sb- cookies (e.g. PKCE code-verifier) aren't base64-prefixed
          if (value && value.startsWith("base64-") && !/\.\d+$/.test(name)) {
            if (!isValidBase64URL(value.slice(7))) {
              return undefined;
            }
          }
          return value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // Radera varje auth-cookie i BÅDA domänvarianterna. `response.cookies.delete`
  // utan domän träffar bara host-only-kopian; ssr:s egen radering träffar bara
  // .usha.se-kopian. En telefon från före domänbytet (2026-07-10) har båda med
  // samma namn, webbläsaren skickar den gamla först, och den gamla vann varje
  // läsning — därav refresh-stormen (#-loggar 2026-09-07). Två skrivningar per
  // namn är det enda som når bägge.
  const clearAuthCookies = () => {
    const names = authCookieNamesFrom(
      request.cookies.getAll().map((c) => `${c.name}=`).join("; ")
    );
    for (const name of names) {
      for (const v of expiredCookieVariants(name, sharedCookieOptions?.domain)) {
        response.cookies.set({ name, value: "", maxAge: 0, path: "/", ...(v.domain ? { domain: v.domain } : {}) });
      }
    }
  };

  try {
    const { data, error } = await supabase.auth.getUser();
    // Defense-in-depth for soft-deleted accounts: the account is banned at the
    // auth layer (so token *refresh* is rejected), but an already-issued access
    // token stays valid until it expires. If its metadata already carries the
    // deleted flag, force a logout now by clearing the auth cookies.
    if (data.user?.user_metadata?.deleted === true) {
      clearAuthCookies();
    }
    // Sessionen finns i cookien men går inte att förnya (död refresh-token).
    // Utan rensning här läser nästa sidladdning samma döda token igen.
    if (!data.user && error && request.cookies.getAll().some((c) => c.name.includes("-auth-token"))) {
      clearAuthCookies();
    }
  } catch {
    // Invalid or corrupted session — clear auth cookies so the browser
    // client doesn't keep hitting "Invalid UTF-8 sequence" errors.
    clearAuthCookies();
  }
  return response;
}
