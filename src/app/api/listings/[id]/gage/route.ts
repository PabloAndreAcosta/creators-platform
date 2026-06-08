import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { GAGE_MIN_SEK, GAGE_MAX_SEK, gageKr } from "@/lib/gage";

// Propose a gage to a crew member (host) or to the host (crew member).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: listingId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("id, user_id, title")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) {
    return NextResponse.json({ error: "Eventet hittades inte" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const amountSek = Number(body?.amount_sek);
  const note = typeof body?.note === "string" ? body.note.trim().slice(0, 300) || null : null;

  if (!Number.isInteger(amountSek) || amountSek < GAGE_MIN_SEK || amountSek > GAGE_MAX_SEK) {
    return NextResponse.json(
      { error: `Beloppet måste vara mellan ${GAGE_MIN_SEK} och ${GAGE_MAX_SEK} kr` },
      { status: 400 }
    );
  }

  const isHost = listing.user_id === user.id;
  let hostId: string;
  let collaboratorUserId: string;
  let proposedBy: "host" | "crew";

  if (isHost) {
    collaboratorUserId = typeof body?.collaborator_user_id === "string" ? body.collaborator_user_id : "";
    if (!collaboratorUserId) {
      return NextResponse.json({ error: "collaborator_user_id krävs" }, { status: 400 });
    }
    hostId = user.id;
    proposedBy = "host";
  } else {
    collaboratorUserId = user.id;
    hostId = listing.user_id;
    proposedBy = "crew";
  }

  // The collaborator must be accepted crew on this listing.
  const { data: collab } = await admin
    .from("listing_collaborators")
    .select("id")
    .eq("listing_id", listingId)
    .eq("user_id", collaboratorUserId)
    .eq("status", "accepted")
    .maybeSingle();
  if (!collab) {
    return NextResponse.json({ error: "Personen är inte med i crewet" }, { status: 403 });
  }

  // Block a second active agreement for this pair.
  const { data: existing } = await admin
    .from("gage_agreements")
    .select("id")
    .eq("listing_id", listingId)
    .eq("collaborator_user_id", collaboratorUserId)
    .in("status", ["proposed", "agreed"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Det finns redan en aktiv gage-överenskommelse" },
      { status: 409 }
    );
  }

  const amountOre = amountSek * 100;
  const { data: agreement, error } = await supabase
    .from("gage_agreements")
    .insert({
      listing_id: listingId,
      host_id: hostId,
      collaborator_user_id: collaboratorUserId,
      amount_ore: amountOre,
      proposed_by: proposedBy,
      status: "proposed",
      note,
    })
    .select("*")
    .single();

  if (error || !agreement) {
    return NextResponse.json({ error: "Kunde inte skapa gage" }, { status: 500 });
  }

  // Notify the counterparty.
  const recipient = isHost ? collaboratorUserId : hostId;
  const proposerName = (await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle())
    .data?.full_name ?? (isHost ? "Värden" : "En kreatör");
  await admin.from("notifications").insert({
    user_id: recipient,
    type: "gage_proposed",
    title: "Gage föreslaget",
    message: `${proposerName} föreslog ${gageKr(amountOre)} för "${listing.title}".`,
    link: isHost ? "/app/my-collaborations" : `/app/events/${listingId}/crew`,
    is_read: false,
  });

  return NextResponse.json({ agreement });
}
