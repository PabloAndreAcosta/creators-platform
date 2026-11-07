import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { delegatedScanAccess } from "@/lib/scan-host-paid";

// Om användaren fått skanna-rätt av en värd (crew, can_scan) eller en lokal
// (dörrteam med "scan"), och om någon av dem är betalande. Skannern öppnas för
// crew när VÄRDEN betalar – crew behöver ingen egen prenumeration.
// Behörigheten per biljett kontrolleras fortfarande per evenemang i
// /api/tickets/verify och /checkin.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ allowed: false, hostPaid: false }, { status: 401 });
  }

  const { delegated, hostPaid } = await delegatedScanAccess(createAdminClient(), user.id);
  return NextResponse.json({ allowed: delegated, hostPaid });
}
