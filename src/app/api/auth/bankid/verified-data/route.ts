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

  // Return only what the client needs — not the hashed NIN
  return NextResponse.json({
    name: data.name,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role,
  });
}
