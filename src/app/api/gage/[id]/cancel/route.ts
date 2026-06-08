import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Either party cancels a proposed/agreed (unpaid) gage.
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
    .select("id, listing_id, host_id, collaborator_user_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!g) {
    return NextResponse.json({ error: "Hittades inte" }, { status: 404 });
  }
  if (user.id !== g.host_id && user.id !== g.collaborator_user_id) {
    return NextResponse.json({ error: "Ingen behörighet" }, { status: 403 });
  }
  if (g.status !== "proposed" && g.status !== "agreed") {
    return NextResponse.json({ error: "Går inte att avbryta" }, { status: 409 });
  }

  const { error } = await supabase
    .from("gage_agreements")
    .update({ status: "canceled", canceled_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["proposed", "agreed"]);
  if (error) {
    return NextResponse.json({ error: "Kunde inte avbryta" }, { status: 500 });
  }

  const other = user.id === g.host_id ? g.collaborator_user_id : g.host_id;
  await admin.from("notifications").insert({
    user_id: other,
    type: "gage_canceled",
    title: "Gage avbrutet",
    message: "En gage-överenskommelse avbröts.",
    link: user.id === g.host_id ? "/app/my-collaborations" : `/app/events/${g.listing_id}/crew`,
    is_read: false,
  });

  return NextResponse.json({ ok: true });
}
