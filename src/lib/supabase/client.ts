import { createBrowserClient } from "@supabase/ssr";
import { sharedCookieOptions } from "./cookie-options";

function makeClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: sharedCookieOptions }
  );
}

// Inferred from makeClient() so the fully-typed client (auth.getSession() etc.)
// is preserved — annotating with ReturnType<typeof createBrowserClient> would
// widen it and lose the types.
let browserClient: ReturnType<typeof makeClient> | undefined;

// Singleton browser client: ONE instance (and thus one autoRefreshToken timer)
// shared across every "use client" component. Returning a fresh client per call
// spawned multiple concurrent auto-refreshers that raced each other and the
// server middleware's refresh; with refresh-token rotation, a lost race revokes
// the session, leaving the browser stuck retrying an invalid refresh token
// (the /token 429 loop that locked users out).
export function createClient() {
  return (browserClient ??= makeClient());
}
