import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canOperateEntrance } from "@/lib/scan-access";
import { getSwishNumber, swishMessage, swishPaymentUrl } from "@/lib/swish/config";

/**
 * Swish-QR:n för dörren: öppnar gästens Swish-app med Ushas nummer, biljettens
 * pris och kvällen som meddelande, allt låst. Bara för evenemang där Usha är
 * säljare — pengarna landar på bolagets konto.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: listingId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title, price, event_date")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canOperateEntrance(admin, user.id, listing))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: owner }, number] = await Promise.all([
    admin.from("profiles").select("is_usha_owned_seller").eq("id", listing.user_id).maybeSingle(),
    getSwishNumber(admin),
  ]);
  if (!owner?.is_usha_owned_seller || !number) return NextResponse.json({ error: "Swish not available" }, { status: 400 });

  let amount = Number(listing.price) || 0;
  const tt = req.nextUrl.searchParams.get("tt");
  if (tt) {
    const { data: type } = await admin.from("ticket_types").select("price").eq("id", tt).eq("listing_id", listingId).maybeSingle();
    if (!type) return NextResponse.json({ error: "Unknown ticket type" }, { status: 400 });
    amount = Number(type.price) || 0;
  }
  if (amount <= 0) return NextResponse.json({ error: "No price" }, { status: 400 });

  const url = swishPaymentUrl({ number, amountSek: amount, message: swishMessage(listing.title, listing.event_date) });
  const png = await QRCode.toBuffer(url, { width: 720, margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  return new NextResponse(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=300" } });
}
