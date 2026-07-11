import { NextRequest, NextResponse } from "next/server";
import { verifyCookieValue } from "@/lib/signicat/crypto";
import type { BankIdVerifiedData } from "@/types/bankid";

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get("bankid_verified")?.value;

  if (!cookie) {
    return NextResponse.json(
      { error: "Ingen BankID-verifiering hittad" },
      { status: 401 }
    );
  }

  const data = verifyCookieValue<BankIdVerifiedData>(cookie);

  if (!data) {
    return NextResponse.json(
      { error: "Ogiltig verifieringsdata" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    // hashedNin is deliberately NOT returned to the client — the pseudonymised
    // personnummer is applied server-side in apply-verification; the signup form
    // only needs the display name + role.
    name: data.name,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
  });
}
