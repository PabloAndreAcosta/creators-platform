import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { swishOfferForListing } from "@/lib/swish/availability";
import { swishPaymentUrl } from "@/lib/swish/config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/swish/qr?listing=<id>&tt=<biljettyp>&qty=<antal>
 *
 * Swish-QR:n på eventsidan, för den som sitter vid datorn och vill betala
 * med telefonen. Öppen (eventsidan är öppen), men servern bygger länken själv
 * ur evenemangets pris: den tar aldrig emot ett belopp eller ett nummer att
 * koda. Bara publika, aktiva evenemang där Usha är säljare.
 */
export async function GET(req: NextRequest) {
  const rl = rateLimit(getRateLimitKey(req, "swish-qr"), 60, 60_000);
  if (!rl.allowed) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const listingId = req.nextUrl.searchParams.get("listing") ?? "";
  if (!UUID.test(listingId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const qty = Math.min(10, Math.max(1, Math.round(Number(req.nextUrl.searchParams.get("qty")) || 1)));

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title, price, event_date, is_active, is_public")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing || !listing.is_active || !listing.is_public) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const offer = await swishOfferForListing(admin, listing);
  if (!offer) return NextResponse.json({ error: "Swish not available" }, { status: 400 });

  let unit = Number(listing.price) || 0;
  const tt = req.nextUrl.searchParams.get("tt");
  if (tt) {
    if (!UUID.test(tt)) return NextResponse.json({ error: "Unknown ticket type" }, { status: 400 });
    const { data: type } = await admin.from("ticket_types").select("price").eq("id", tt).eq("listing_id", listingId).maybeSingle();
    if (!type) return NextResponse.json({ error: "Unknown ticket type" }, { status: 400 });
    unit = Number(type.price) || 0;
  }
  if (unit <= 0) return NextResponse.json({ error: "No price" }, { status: 400 });

  const url = swishPaymentUrl({ number: offer.number, amountSek: unit * qty, message: offer.message });
  const png = await QRCode.toBuffer(url, { width: 640, margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=300" } });
}
