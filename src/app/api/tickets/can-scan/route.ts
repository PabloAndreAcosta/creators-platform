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

  if (data) return NextResponse.json({ allowed: true });

  // Dörrvärden i en lokals team har ingen rad per evenemang — behörigheten
  // sitter på lokalen. Utan det här öppnas aldrig skannern för hen, och
  // `scan`-behörigheten blir en kryssruta utan verkan.
  //
  // RLS på venue_members släpper igenom den egna raden, så användarens egen
  // klient räcker.
  const { data: member } = await supabase
    .from("venue_members")
    .select("capabilities")
    .eq("user_id", user.id)
    .not("accepted_at", "is", null)
    .is("removed_at", null);

  const kanSkanna = (member ?? []).some((m: { capabilities: string[] | null }) =>
    (m.capabilities ?? []).includes("scan")
  );

  return NextResponse.json({ allowed: kanSkanna });
}
