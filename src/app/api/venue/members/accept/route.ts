import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Acceptera en inbjudan till ett lokalteam.
 *
 * Behörigheten börjar gälla här och inte när ägaren skickade inbjudan — man ska
 * inte kunna göras ansvarig för någon annans lokal utan att ha sagt ja.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran" }, { status: 400 });
  }
  if (!body.token) return NextResponse.json({ error: "Token krävs" }, { status: 400 });

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("venue_members")
    .select("id, venue_profile_id, user_id, invited_email, accepted_at, removed_at, expires_at")
    .eq("token", body.token)
    .maybeSingle();

  if (!invite) return NextResponse.json({ error: "Inbjudan hittades inte." }, { status: 404 });
  if (invite.removed_at) return NextResponse.json({ error: "Inbjudan är återkallad." }, { status: 410 });
  if (invite.accepted_at) return NextResponse.json({ error: "Inbjudan är redan accepterad." }, { status: 409 });
  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Inbjudan har gått ut." }, { status: 410 });
  }

  // En inbjudan riktad till ett konto kan bara accepteras av det kontot. En
  // riktad till en mejladress kräver att den inloggade äger adressen — annars
  // vore en vidarebefordrad länk nog för att ta sig in i någon annans lokal.
  if (invite.user_id && invite.user_id !== user.id) {
    return NextResponse.json({ error: "Inbjudan gäller någon annan." }, { status: 403 });
  }
  if (!invite.user_id) {
    const inbjudenAdress = (invite.invited_email ?? "").toLowerCase();
    if (!user.email || user.email.toLowerCase() !== inbjudenAdress) {
      return NextResponse.json(
        { error: "Inbjudan gäller en annan mejladress. Logga in med den adressen." },
        { status: 403 }
      );
    }
  }
  if (invite.venue_profile_id === user.id) {
    return NextResponse.json({ error: "Du äger redan lokalen." }, { status: 400 });
  }

  const { error } = await admin
    .from("venue_members")
    .update({
      user_id: user.id,
      invited_email: null,
      accepted_at: new Date().toISOString(),
      token: null,
    })
    .eq("id", invite.id);

  if (error) {
    console.error("[venue-members] accept:", error.message);
    return NextResponse.json({ error: "Kunde inte acceptera inbjudan." }, { status: 500 });
  }

  return NextResponse.json({ accepted: true, venueProfileId: invite.venue_profile_id });
}
