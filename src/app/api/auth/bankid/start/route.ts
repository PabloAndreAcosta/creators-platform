import { NextRequest, NextResponse } from "next/server";
import { createBankIdSession } from "@/lib/signicat/client";

export async function POST(req: NextRequest) {
  try {
    const { role } = await req.json();

    if (!role || !["creator", "experience"].includes(role)) {
      return NextResponse.json(
        { error: "Ogiltig roll" },
        { status: 400 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const session = await createBankIdSession(baseUrl);

    const response = NextResponse.json({
      authenticationUrl: session.authenticationUrl,
    });

    // Store session ID and role in httpOnly cookie for the callback
    response.cookies.set("bankid_session", JSON.stringify({
      sessionId: session.id,
      role,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    return response;
  } catch (err) {
    console.error("BankID start error:", err);
    return NextResponse.json(
      { error: "Kunde inte starta BankID-verifiering" },
      { status: 500 }
    );
  }
}
