import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCookieValue } from "@/lib/signicat/crypto";
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

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      bankid_verified_at: data.verifiedAt,
      bankid_personal_number: data.hashedNin,
      bankid_name: data.name,
      role: data.role,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("apply-verification update failed:", updateError.message);
    return NextResponse.json({ error: "Kunde inte spara verifiering" }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set("bankid_verified", "", { path: "/", maxAge: 0 });
  return response;
}
