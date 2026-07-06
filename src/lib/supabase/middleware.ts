import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  try {
    const { data } = await supabase.auth.getUser();
    // Defense-in-depth for soft-deleted accounts: the account is banned at the
    // auth layer (so token *refresh* is rejected), but an already-issued access
    // token stays valid until it expires. If its metadata already carries the
    // deleted flag, force a logout now by clearing the auth cookies.
    if (data.user?.user_metadata?.deleted === true) {
      const authCookies = [...request.cookies.getAll()]
        .filter((c) => c.name.includes("-auth-token"))
        .map((c) => c.name);
      for (const name of authCookies) {
        response.cookies.delete(name);
      }
    }
  } catch {
    // Invalid or corrupted session — clear auth cookies so the browser
    // client doesn't keep hitting "Invalid UTF-8 sequence" errors.
    const authCookies = [...request.cookies.getAll()]
      .filter((c) => c.name.includes("-auth-token"))
      .map((c) => c.name);
    for (const name of authCookies) {
      response.cookies.delete(name);
    }
  }
  return response;
}
