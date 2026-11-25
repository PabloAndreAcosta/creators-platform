import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { decideSwishBooking, SWISH_LISTING_SELECT, type SwishListing } from "@/lib/swish/confirm";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/events/[id]/entry/swish/confirm — avgör ett vilande Swish-köp.
 * { bookingId, action: "confirm" | "reject", checkIn?: boolean, via?: "notice" }
 *
 * Dörrens knappar och bekräftelsesidan från notisen anropar båda hit.
 * Själva avgörandet bor i lib/swish/confirm.ts; här sitter grinden: bara den
 * som får sköta entrén (ägaren, admin, crew med can_scan).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const rl = rateLimit(getRateLimitKey(req, "entry-swish-confirm"), 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { id: listingId } = await params;
  if (!UUID.test(listingId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: { bookingId?: string; action?: string; checkIn?: boolean; via?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const bookingId = String(payload.bookingId ?? "");
  if (!UUID.test(bookingId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  if (payload.action !== "confirm" && payload.action !== "reject") return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const admin = createAdminClient();
  const { data: listing } = await admin.from("listings").select(SWISH_LISTING_SELECT).eq("id", listingId).maybeSingle();
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canOperateEntrance(admin, user.id, listing as SwishListing))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await decideSwishBooking(admin, {
    listing: listing as SwishListing,
    bookingId,
    action: payload.action,
    checkIn: payload.checkIn === true,
    decidedBy: user.id,
    via: payload.via === "notice" ? "från notisen" : "i entrén",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.httpStatus });
  return NextResponse.json(result);
}
