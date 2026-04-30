import { NextRequest, NextResponse } from "next/server";
import { createBankIdSession } from "@/lib/signicat/client";

export async function POST(req: NextRequest) {
  try {
    const { role, subcategory } = await req.json();

    if (!role || !["creator", "experience"].includes(role)) {
      return NextResponse.json(
        { error: "Ogiltig roll" },
        { status: 400 }
      );
    }

    const resolvedSubcategory =
      role === "creator" && subcategory === "taxi_dancer"
        ? "taxi_dancer"
        : "general";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const session = await createBankIdSession(baseUrl);

    const response = NextResponse.json({
      authenticationUrl: session.authenticationUrl,
    });

    // Store session ID, role, and subcategory in httpOnly cookie for the callback
    response.cookies.set("bankid_session", JSON.stringify({
      sessionId: session.id,
      role,
      subcategory: resolvedSubcategory,
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    return response;
  } catch (err) {
    console.error("BankID start error:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { error: "Kunde inte starta BankID-verifiering. Försök igen." },
      { status: 500 }
    );
  }
}
