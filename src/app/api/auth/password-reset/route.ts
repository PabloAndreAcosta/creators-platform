import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset";

/**
 * Glömt lösenord — Usha skickar länken själv.
 *
 * Supabases egen länk pekade på /auth/v1/verify, som förbrukar engångskoden
 * så fort någon öppnar den. Gmails länkkontroll öppnar den sekunder efter
 * användaren, och PKCE-varianten fungerade bara i webbläsaren som begärde den.
 * Här tas en kod fram med service-rollen och skickas som en länk till
 * usha.se/reset-password; koden används först när det nya lösenordet sparas
 * (verifyOtp på sidan). Fungerar på vilken enhet som helst, och en skanner
 * som öppnar länken förstör ingenting.
 *
 * Svaret är alltid detsamma, oavsett om adressen har ett konto — annars går
 * det att fråga sig fram till vilka adresser som finns.
 */
export async function POST(req: NextRequest) {
  const ok = NextResponse.json({ ok: true });
  let email = "";
  let locale: string | null = null;
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
    locale = typeof body?.locale === "string" ? body.locale : null;
  } catch {
    return NextResponse.json({ error: "Ogiltig förfrågan" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Ogiltig e-postadress" }, { status: 400 });
  }

  // Per IP och per adress, så att ingen kan översvämma en inkorg.
  const byIp = rateLimit(getRateLimitKey(req, "pwreset"), 5, 10 * 60_000);
  const byEmail = rateLimit(`pwreset:${email}`, 3, 60 * 60_000);
  if (!byIp.allowed || !byEmail.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const { data, error } = await createAdminClient().auth.admin.generateLink({ type: "recovery", email });
  // Ingen användare med adressen → samma svar, inget mejl.
  if (error || !data?.properties?.hashed_token) return ok;

  const base = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
  const resetUrl = `${base}/reset-password?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
  try {
    await sendPasswordResetEmail({ to: email, resetUrl, locale });
  } catch {
    return NextResponse.json({ error: "send_failed" }, { status: 500 });
  }
  return ok;
}
