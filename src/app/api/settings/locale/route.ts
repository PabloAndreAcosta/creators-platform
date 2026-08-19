import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { locales } from "@/i18n/config";

/**
 * Remembers the language a signed-in person reads the app in.
 *
 * The cookie is enough for pages, but mail is composed later and elsewhere — a
 * nightly reminder, a Stripe webhook — with no cookie in sight. This is where
 * the choice is kept so a receipt arrives in the same language as the app.
 *
 * Signed-out visitors get an ok with nothing stored: they still have the
 * cookie, and there is no profile to write to.
 */
export async function POST(req: NextRequest) {
  let body: { locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const locale = body?.locale;
  if (typeof locale !== "string" || !(locales as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, stored: false });

  const { error } = await supabase.from("profiles").update({ locale }).eq("id", user.id);
  if (error) {
    console.error("locale update failed:", error);
    return NextResponse.json({ error: "Could not save language" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: true });
}
