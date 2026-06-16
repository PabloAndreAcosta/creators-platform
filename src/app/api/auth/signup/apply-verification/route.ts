import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCookieValue } from "@/lib/signicat/crypto";
import { computeAge } from "@/lib/age";
import type { BankIdVerifiedData } from "@/types/bankid";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Inte autentiserad" }, { status: 401 });
  }

  const cookie = req.cookies.get("bankid_verified")?.value;
  if (!cookie) {
    return NextResponse.json({ error: "Ingen BankID-verifiering hittad" }, { status: 400 });
  }

  const data = verifyCookieValue<BankIdVerifiedData>(cookie);
  if (!data) {
    return NextResponse.json({ error: "Ogiltig verifieringsdata" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Defense-in-depth age gate: reject if profile is taxi_dancer and verified DOB indicates < 18.
  // The primary gate is in /api/auth/bankid/callback before issuing this cookie, but we re-check
  // here in case subcategory was set after callback or via direct profile update.
  const { data: profile } = await admin
    .from("profiles")
    .select("creator_subcategory")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.creator_subcategory === "taxi_dancer" && computeAge(data.dateOfBirth) < 18) {
    await admin
      .from("profiles")
      .update({ creator_subcategory: "general" })
      .eq("id", user.id);

    const response = NextResponse.json(
      { error: "Du måste vara minst 18 år för att registrera dig som taxidansare" },
      { status: 403 }
    );
    response.cookies.set("bankid_verified", "", { path: "/", maxAge: 0 });
    return response;
  }

  const { data: dup } = await admin
    .from("profiles")
    .select("id")
    .eq("bankid_personal_number", data.hashedNin)
    .neq("id", user.id)
    .maybeSingle();

  if (dup) {
    const response = NextResponse.json(
      { error: "Personnummer redan registrerat" },
      { status: 409 }
    );
    response.cookies.set("bankid_verified", "", { path: "/", maxAge: 0 });
    return response;
  }

  // Apply only the BankID identity fields. Deliberately NOT role/subcategory:
  // those are already set at account creation (handle_new_user, from the signup
  // metadata). This route runs on every login, so overwriting role here would
  // let a stale/replayed bankid_verified cookie flip an established account's
  // role (e.g. a venue back to creator). BankID verification proves identity —
  // it must never change the account's role.
  const updatePayload: Record<string, string> = {
    bankid_verified_at: data.verifiedAt,
    bankid_personal_number: data.hashedNin,
    bankid_name: data.name,
  };

  const { error: updateError } = await admin
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id);

  if (updateError) {
    console.error("apply-verification update failed:", updateError.message);
    return NextResponse.json({ error: "Kunde inte spara verifiering" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("bankid_verified", "", { path: "/", maxAge: 0 });
  return response;
}
