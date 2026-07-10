import type { CookieOptionsWithName } from "@supabase/ssr";

// Sharing the auth session across usha.se and shop.usha.se requires the Supabase
// auth cookie to be scoped to the parent domain (".usha.se") instead of being
// host-only. This is gated on NEXT_PUBLIC_COOKIE_DOMAIN so that:
//   - local dev (localhost) and Vercel previews (*.vercel.app) leave it unset →
//     host-only cookies, identical to today (zero behaviour change).
//   - production sets NEXT_PUBLIC_COOKIE_DOMAIN=".usha.se" to enable sharing.
//
// IMPORTANT: all three Supabase client variants (browser, server, middleware)
// MUST use the same value, or token refresh writes a differently-scoped cookie
// than the one that gets read → random logouts. Hence this single source.
//
// Note: when the domain is first switched on in production, existing host-only
// cookies coexist with the new parent-domain ones until they expire; users may
// need to log in once more. This is a one-time transition.
const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

export const sharedCookieOptions: CookieOptionsWithName | undefined = domain
  ? { domain }
  : undefined;
