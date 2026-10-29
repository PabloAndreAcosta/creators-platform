import { NextResponse } from "next/server";
import { getSignupCreditEnabled } from "@/lib/credits/flag";

/** För registreringssidan (en klientsida): visas rutan om välkomstavdraget? */
export async function GET() {
  return NextResponse.json(
    { enabled: await getSignupCreditEnabled() },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
