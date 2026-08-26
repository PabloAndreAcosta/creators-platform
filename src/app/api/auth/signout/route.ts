import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // signOut() expires the auth cookie using sharedCookieOptions, i.e. scoped to
  // NEXT_PUBLIC_COOKIE_DOMAIN (".usha.se" in production). A Set-Cookie carrying
  // Domain=.usha.se cannot delete a HOST-ONLY cookie of the same name — to the
  // browser those are two separate cookies, and it keeps sending both.
  //
  // Sessions created before the domain was switched on are host-only. They
  // therefore survive every logout, ride along on every request, and the server
  // may read the stale one instead of the live one. The symptom is being told
  // "Ej inloggad" by a server action while the page around it renders as logged
  // in — which one wins is effectively arbitrary.
  //
  // So expire every Supabase auth cookie a second time WITHOUT a domain, which
  // is the only way to target the host-only variant. Chunked cookies (…​.0, .1)
  // are covered because we enumerate whatever is actually present.
  const store = await cookies();
  for (const { name } of store.getAll()) {
    if (!name.startsWith("sb-")) continue;
    store.set({ name, value: "", path: "/", maxAge: 0 });
  }

  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL || "https://usha.se"), {
    status: 302,
  });
}
