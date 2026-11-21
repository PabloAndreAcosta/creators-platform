import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, sharedCookieOptions } from "./cookie-options";
import { guardSessionCookies } from "./session-cookie";

export async function createClient() {
  const cookieStore = await cookies();
  // En session vars chunkar inte går att sätta ihop till ett objekt läses som
  // saknad — annars kraschar auth-js med "Cannot create property 'user' on
  // string" (se session-cookie.ts).
  const readCookie = guardSessionCookies(
    (name) => cookieStore.get(name)?.value,
    AUTH_COOKIE_NAME
  );

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: sharedCookieOptions,
      cookies: {
        get(name: string) {
          const value = readCookie(name);
          // Skip corrupt cookies to prevent Invalid UTF-8 sequence errors.
          // Only validate the UNCHUNKED, base64-prefixed session cookie:
          //  - the "base64-" prefix is not itself base64, so validate value.slice(7)
          //  - chunk cookies (name ".0", ".1", …) hold base64 *fragments* that are
          //    not independently decodable — validating them drops valid large
          //    sessions (combineChunks stops at the first missing chunk)
          //  - other sb- cookies (e.g. PKCE code-verifier) aren't base64-prefixed
          if (value && value.startsWith("base64-") && !/\.\d+$/.test(name)) {
            try {
              atob(value.slice(7).replace(/-/g, "+").replace(/_/g, "/"));
            } catch {
              return undefined;
            }
          }
          return value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle cookies in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch (error) {
            // Handle cookies in Server Components
          }
        },
      },
    }
  );
}
