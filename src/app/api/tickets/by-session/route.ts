import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { CHECKOUT_SESSION_RE, findBookingForSession } from "@/lib/tickets/session-booking";

/**
 * GET /api/tickets/by-session?session_id=cs_…
 *
 * Svarar med bokningens id när webhooken har skrivit den, annars 404.
 * Kvittosidan pollar hit tills biljetten finns, så gästen slipper mejlen.
 * Ingen inloggning: sessions-id:t är kapabiliteten, precis som på kvittosidan.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "ticket-by-session"), 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const sessionId = req.nextUrl.searchParams.get("session_id") ?? "";
  if (!CHECKOUT_SESSION_RE.test(sessionId)) return NextResponse.json({ error: "Bad session" }, { status: 400 });

  try {
    const booking = await findBookingForSession(sessionId);
    if (!booking) return NextResponse.json({ error: "Not yet" }, { status: 404 });
    return NextResponse.json({ id: booking.id }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Not yet" }, { status: 404 });
  }
}
