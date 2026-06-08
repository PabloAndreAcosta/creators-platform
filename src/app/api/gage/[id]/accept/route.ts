import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gageKr } from "@/lib/gage";

// The counterparty accepts a proposed gage → status 'agreed'.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: g } = await admin
    .from("gage_agreements")
    .select("id, listing_id, host_id, collaborator_user_id, amount_ore, proposed_by, status")
    .eq("id", id)
    .maybeSingle();

  if (!g) {
    return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
  }
  if (g.status !== "proposed") {
    return NextResponse.json({ error: "Går inte att acceptera längre" }, { status: 409 });
  }

  // Only the party who did NOT propose may accept.
  const accepterMustBe = g.proposed_by === "host" ? g.collaborator_user_id : g.host_id;
  if (user.id !== accepterMustBe) {
    return NextResponse.json({ error: "Du kan inte acceptera den här" }, { status: 403 });
  }

  const { error } = await supabase
    .from("gage_agreements")
    .update({ status: "agreed", agreed_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "proposed");
  if (error) {
    return NextResponse.json({ error: "Kunde inte acceptera" }, { status: 500 });
  }

  const { data: listing } = await admin
    .from("listings")
    .select("title")
    .eq("id", g.listing_id)
    .maybeSingle();
  // Notify the original proposer.
  const proposer = g.proposed_by === "host" ? g.host_id : g.collaborator_user_id;
  await admin.from("notifications").insert({
    user_id: proposer,
    type: "gage_agreed",
    title: "Gage överenskommet",
    message: `${gageKr(g.amount_ore)} för "${listing?.title ?? "eventet"}" är överenskommet.`,
    link: g.proposed_by === "host" ? `/app/events/${g.listing_id}/crew` : "/app/my-collaborations",
    is_read: false,
  });

  return NextResponse.json({ ok: true });
}
