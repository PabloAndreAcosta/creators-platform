import { NextRequest, NextResponse } from "next/server";
import { getBankIdSessionResult } from "@/lib/signicat/client";
import { signCookieValue, hashPersonalNumber } from "@/lib/signicat/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BankIdVerifiedData } from "@/types/bankid";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const status = searchParams.get("status");
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || origin;

  // Read session cookie
  const sessionCookie = req.cookies.get("bankid_session")?.value;
  if (!sessionCookie) {
    return NextResponse.redirect(`${baseUrl}/signup?bankid=error`);
  }

  let sessionData: { sessionId: string; role: string };
  try {
    sessionData = JSON.parse(sessionCookie);
  } catch {
    return NextResponse.redirect(`${baseUrl}/signup?bankid=error`);
  }

  // If user aborted or error occurred
  if (status !== "success") {
    const response = NextResponse.redirect(
      `${baseUrl}/signup?bankid=${status === "abort" ? "aborted" : "failed"}`
    );
    response.cookies.set("bankid_session", "", { path: "/", maxAge: 0 });
    return response;
  }

  try {
    // Fetch verification result from Signicat
    const result = await getBankIdSessionResult(sessionData.sessionId);

    if (result.status !== "SUCCESS" || !result.subject) {
      const response = NextResponse.redirect(`${baseUrl}/signup?bankid=failed`);
      response.cookies.set("bankid_session", "", { path: "/", maxAge: 0 });
      return response;
    }

    const { firstName, lastName, name, dateOfBirth, nin } = result.subject;
    const hashedNin = hashPersonalNumber(nin.value);

    // Check for duplicate personnummer
    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("bankid_personal_number", hashedNin)
      .maybeSingle();

    if (existing) {
      const response = NextResponse.redirect(
        `${baseUrl}/signup?bankid=duplicate`
      );
      response.cookies.set("bankid_session", "", { path: "/", maxAge: 0 });
      return response;
    }

    // Store verified data in signed cookie
    const verifiedData: BankIdVerifiedData = {
      name,
      firstName,
      lastName,
      dateOfBirth,
      hashedNin,
      verifiedAt: new Date().toISOString(),
      role: sessionData.role as "creator" | "experience",
    };

    const signedValue = signCookieValue(verifiedData);

    const response = NextResponse.redirect(`${baseUrl}/signup?bankid=success`);
    response.cookies.set("bankid_verified", signedValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    response.cookies.set("bankid_session", "", { path: "/", maxAge: 0 });
    return response;
  } catch (err) {
    console.error("BankID callback error:", err);
    const response = NextResponse.redirect(`${baseUrl}/signup?bankid=error`);
    response.cookies.set("bankid_session", "", { path: "/", maxAge: 0 });
    return response;
  }
}
