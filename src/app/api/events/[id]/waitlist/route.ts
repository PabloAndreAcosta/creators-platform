import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidEmail, normalizeEmail, cleanName } from "@/lib/waitlist";

// Public, unauthenticated: a guest joins an event's waitlist (name + email).
// Writes via service role (never anon) so the table stays insert-locked at RLS.
// Idempotent: re-submitting the same email for the same event is a no-op "ok".
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const te = await getTranslations("eventErrors");

  let body: { name?: unknown; email?: unknown; source?: unknown; consent?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: te("generic") }, { status: 400 });
  }

  if (!isValidEmail(body.email)) {
    return NextResponse.json({ error: te("invalidEmail") }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json({ error: te("consentRequired") }, { status: 400 });
  }

  const admin = createAdminClient();

  // The event must exist and be active to accept signups.
  const { data: listing } = await admin
    .from("listings")
    .select("id")
    .eq("id", listingId)
    .eq("is_active", true)
    .maybeSingle();
  if (!listing) {
    return NextResponse.json({ error: te("eventNotFound") }, { status: 404 });
  }

  const email = normalizeEmail(body.email);
  const name = cleanName(body.name);
  const source = typeof body.source === "string" ? body.source.slice(0, 40) : "event_page";

  const { error } = await admin
    .from("event_waitlist")
    .insert({ listing_id: listingId, email, name, source });

  // 23505 = unique_violation → already on the list. Treat as success (idempotent).
  if (error && error.code !== "23505") {
    console.error("waitlist insert failed:", error);
    return NextResponse.json({ error: te("generic") }, { status: 500 });
  }

  return NextResponse.json({ ok: true, alreadyOn: error?.code === "23505" });
}
