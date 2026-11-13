import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, normalizeRole, type Role } from "@/lib/roles";

/**
 * Byt roll på det egna kontot: publik, kreatör eller lokal.
 *
 * Förr gick rollbytet via ett planköp — Stripe-webhooken läste rollen ur
 * checkout-metadatan. När Guld och Premium togs bort (2026-11-13) försvann
 * den vägen, och den som registrerat sig som publik och sedan vill sälja
 * hade ingen knapp. Lokaler drabbades mest: de registrerar sig nästan alltid
 * som besökare först.
 *
 * Rollen är en skyddad kolumn (protect_profile_privileged_columns släpper
 * bara igenom service_role), så skrivningen går via admin-klienten efter att
 * inloggningen kontrollerats. Det här är den femte rollskrivaren; de andra
 * fyra står i lib/roles.ts-kommentaren och alla går via normalizeRole.
 *
 * Bytet ger inga rättigheter i sig: en kreatör måste fortfarande ha BankID
 * för att publicera och sälja (RLS på listings), en lokal måste verifiera
 * bolaget för att synas. Det rollen styr är vilka ytor appen visar.
 */

const ALLOWED: Role[] = [ROLES.CUSTOMER, ROLES.CREATOR, ROLES.VENUE];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return NextResponse.json({ role: normalizeRole(data?.role) ?? ROLES.CUSTOMER });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { role?: unknown } | null;
  const role = normalizeRole(typeof body?.role === "string" ? body.role : null);
  if (!role || !ALLOWED.includes(role)) {
    return NextResponse.json({ error: "invalid_role" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: before } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (normalizeRole(before.role) === role) return NextResponse.json({ role, changed: false });

  const { error } = await admin.from("profiles").update({ role }).eq("id", user.id);
  if (error) {
    console.error("role switch failed:", error);
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ role, changed: true });
}
