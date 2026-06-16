import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeOrgNumber, formatOrgNumber, verifyViaVies } from "@/lib/org-number";
import { isVenueRole } from "@/lib/roles";

export async function POST(req: NextRequest) {
  const { rateLimit, getRateLimitKey } = await import("@/lib/rate-limit");
  const rl = rateLimit(getRateLimitKey(req, "verify-company"), 5, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "För många försök, vänta en stund." }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  }

  // Only venues verify a company.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!isVenueRole(profile?.role)) {
    return NextResponse.json({ error: "Endast venues kan verifiera bolag." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const org = normalizeOrgNumber(body?.orgNumber ?? "");
  if (!org) {
    return NextResponse.json(
      { error: "Ogiltigt organisationsnummer. Kontrollera siffrorna." },
      { status: 400 }
    );
  }

  const result = await verifyViaVies(org);

  if (result.status === "unavailable") {
    // Transient VIES / member-state error — do not reject, ask to retry.
    return NextResponse.json(
      { error: "Verifieringstjänsten är tillfälligt otillgänglig. Försök igen om en stund." },
      { status: 503 }
    );
  }
  if (result.status === "invalid") {
    return NextResponse.json(
      { error: "Numret är inte ett registrerat (momspliktigt) bolag." },
      { status: 422 }
    );
  }

  // Valid — record verification with the official VIES name (privileged columns,
  // written via the service-role client so the protect trigger allows it).
  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("profiles")
    .update({
      org_number: org,
      company_name: result.name || null,
      company_verified_at: new Date().toISOString(),
      company_verification_method: "vies",
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Kunde inte spara verifieringen." }, { status: 500 });
  }

  return NextResponse.json({
    verified: true,
    orgNumber: formatOrgNumber(org),
    companyName: result.name || null,
  });
}
