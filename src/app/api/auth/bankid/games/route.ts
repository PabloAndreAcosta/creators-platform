import { NextRequest, NextResponse } from "next/server";
import { createBankIdSession } from "@/lib/signicat/client";
import { signCookieValue } from "@/lib/signicat/crypto";
import { gamesReturnUrl, gamesSecret, safeGamesReturn } from "@/lib/bankid/games-token";

/**
 * GET /api/auth/bankid/games?return=/spel/?vuxen
 *
 * Startar en BankID-legitimering för vuxenspelen på ushagames.se. Det är en
 * vanlig navigering (inte ett fetch-anrop från spelens domän), så att
 * bankid_session-cookien blir förstapartscookie här på usha.se. Callbacken
 * känner igen läget "games" och skickar tillbaka till spelen.
 */
export async function GET(req: NextRequest) {
  const ret = safeGamesReturn(req.nextUrl.searchParams.get("return"));
  try {
    const { rateLimit, getRateLimitKey } = await import("@/lib/rate-limit");
    const rl = rateLimit(getRateLimitKey(req, "bankid-games"), 10, 60_000);
    if (!rl.allowed || !gamesSecret()) {
      return NextResponse.redirect(gamesReturnUrl(ret, { fel: "fel" }));
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const session = await createBankIdSession(baseUrl);

    const response = NextResponse.redirect(session.authenticationUrl);
    response.cookies.set("bankid_session", signCookieValue({ sessionId: session.id, mode: "games", ret }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  } catch (err) {
    console.error("BankID games start error:", err instanceof Error ? err.message : err);
    return NextResponse.redirect(gamesReturnUrl(ret, { fel: "fel" }));
  }
}
