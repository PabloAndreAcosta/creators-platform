import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";

// Public QR image for a booking's ticket, so it can be embedded directly in the
// confirmation email (guests without an account can't reach the in-app modal).
// The QR only encodes the verify URL — scanning still requires an authenticated
// scanner (owner/crew) to actually check anyone in, so exposing the image is safe.
export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const id = params.get("id");
  // Optional attendee id: for a multi-ticket order each attendee gets their own
  // QR (…&att=<attendeeId>) so it can be scanned/checked in individually.
  const att = params.get("att");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  const code = `USH-${id.slice(0, 8).toUpperCase()}`;
  const verifyUrl = `${appUrl}/api/tickets/verify?code=${code}&id=${id}${att ? `&att=${att}` : ""}`;

  const png = await QRCode.toBuffer(verifyUrl, {
    width: 240,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#000000", light: "#ffffff" },
  });

  return new NextResponse(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
