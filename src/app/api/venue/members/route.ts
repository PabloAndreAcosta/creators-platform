import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isVenueRole } from "@/lib/roles";
import { sanitizeCapabilities, expandPreset } from "@/lib/venues/members";

/**
 * Lokalens team.
 *
 * Ägaren ÄR lokalen, så det finns ingen parameter för vilken lokal det gäller —
 * den är den inloggades egen profil. Det är inte en förenkling utan hela
 * modellen: kan man inte peka ut en annan lokal kan man inte heller råka ändra
 * i den.
 */

/** Lokalen (= den inloggade) eller ett felsvar. */
async function requireVenueOwner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Ej inloggad" }, { status: 401 }) };

  // role är kolumn-låst för authenticated, och PostgREST fäller hela frågan om
  // en enda kolumn saknar grant — därför service-role för uppslaget.
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!isVenueRole(profile?.role)) {
    return { error: NextResponse.json({ error: "Bara lokaler har team." }, { status: 403 }) };
  }
  return { user, admin };
}

export async function GET() {
  const ctx = await requireVenueOwner();
  if ("error" in ctx) return ctx.error;

  const { data } = await ctx.admin
    .from("venue_members")
    .select("id, user_id, invited_email, capabilities, accepted_at, removed_at, invited_at, token, profiles!user_id(full_name, avatar_url)")
    .eq("venue_profile_id", ctx.user.id)
    .is("removed_at", null)
    .order("invited_at", { ascending: true });

  const members = (data ?? []).map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.id,
      name: p?.full_name ?? null,
      email: m.invited_email,
      capabilities: sanitizeCapabilities(m.capabilities),
      accepted: !!m.accepted_at,
      // Länken delas av ägaren själv i fas 1. Den visas bara så länge
      // inbjudan är obesvarad.
      inviteToken: m.accepted_at ? null : m.token,
    };
  });

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const ctx = await requireVenueOwner();
  if ("error" in ctx) return ctx.error;

  let body: { email?: string; preset?: string; capabilities?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: "Ange en giltig mejladress." }, { status: 400 });
  }

  const capabilities = body.preset
    ? expandPreset(body.preset)
    : sanitizeCapabilities(body.capabilities);

  // Redan medlem? Om personen har konto pekar vi raden på kontot direkt, så att
  // den inte behöver acceptera en inbjudan till en adress hen redan bevisat.
  const { data: existingProfile } = await ctx.admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile?.id === ctx.user.id) {
    return NextResponse.json(
      { error: "Du äger redan lokalen och behöver inte bjuda in dig själv." },
      { status: 400 }
    );
  }

  const token = randomBytes(24).toString("base64url");

  const { data: row, error } = await ctx.admin
    .from("venue_members")
    .insert({
      venue_profile_id: ctx.user.id,
      user_id: existingProfile?.id ?? null,
      invited_email: existingProfile?.id ? null : email,
      capabilities,
      token,
      invited_by: ctx.user.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Personen är redan inbjuden." }, { status: 409 });
    }
    console.error("[venue-members] insert:", error.message);
    return NextResponse.json({ error: "Kunde inte skapa inbjudan." }, { status: 500 });
  }

  return NextResponse.json({ id: row.id, token });
}
