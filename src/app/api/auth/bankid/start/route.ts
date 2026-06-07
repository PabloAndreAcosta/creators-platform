import { NextRequest, NextResponse } from "next/server";
import { createBankIdSession } from "@/lib/signicat/client";

export async function POST(req: NextRequest) {
  try {
    const { role, subcategory, mode, next } = await req.json();

    if (!role || !["creator", "experience"].includes(role)) {
      return NextResponse.json(
        { error: "Ogiltig roll" },
        { status: 400 }
      );
    }

    const resolvedMode: "signup" | "add" = mode === "add" ? "add" : "signup";

    const resolvedSubcategory =
      role === "creator" && subcategory === "taxi_dancer"
        ? "taxi_dancer"
        : "general";

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const session = await createBankIdSession(baseUrl);

    const response = NextResponse.json({
      authenticationUrl: session.authenticationUrl,
    });

    const safeNext = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;

    response.cookies.set("bankid_session", JSON.stringify({
      sessionId: session.id,
      role,
      subcategory: resolvedSubcategory,
      mode: resolvedMode,
      next: safeNext,
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
