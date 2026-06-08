import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Whether the signed-in user has been delegated ticket scanning on any event.
// Used to open the scanner UI for crew members (per-ticket authorization is
// still enforced per event in /api/tickets/verify and /checkin).
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ allowed: false }, { status: 401 });
  }

  // RLS allows self-select on listing_collaborators.
  const { data } = await supabase
    .from("listing_collaborators")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "accepted")
    .eq("can_scan", true)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ allowed: !!data });
}
