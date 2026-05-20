import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const value = cookieStore.get(name)?.value;
          // Skip corrupt cookies to prevent Invalid UTF-8 sequence errors.
          // The @supabase/ssr value carries a literal "base64-" prefix that is
          // NOT itself base64 — validate only the payload after it, otherwise
          // atob() throws for ~1/4 of cookie lengths and drops valid sessions.
          if (value && name.startsWith("sb-")) {
            const payload = value.startsWith("base64-") ? value.slice(7) : value;
            try {
              atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
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
