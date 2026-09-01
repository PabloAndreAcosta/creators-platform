import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sanitizeCapabilities, expandPreset } from "@/lib/venues/members";

/**
 * Ändra eller ta bort en medlem.
 *
 * Båda filtrerar på `venue_profile_id = user.id` utöver rad-id. Det är inte
 * dubbelkoll för sakens skull: utan det skulle ett gissat id räcka för att ändra
 * någon annans team.
 */

async function owner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  const { id } = await params;

  let body: { preset?: string; capabilities?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig begäran" }, { status: 400 });
  }

  const capabilities = body.preset
    ? expandPreset(body.preset)
    : sanitizeCapabilities(body.capabilities);

  const { data, error } = await createAdminClient()
    .from("venue_members")
    .update({ capabilities })
    .eq("id", id)
    .eq("venue_profile_id", user.id)
    .is("removed_at", null)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Kunde inte spara." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Medlemmen hittades inte." }, { status: 404 });

  return NextResponse.json({ capabilities });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await owner();
  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  const { id } = await params;

  // Mjuk borttagning: raden behålls så att en återinbjudan uppdaterar samma rad
  // i stället för att krocka med unikhetsvillkoret, och så att det går att se
  // att personen HAR haft tillgång.
  const { data, error } = await createAdminClient()
    .from("venue_members")
    .update({ removed_at: new Date().toISOString(), capabilities: [] })
    .eq("id", id)
    .eq("venue_profile_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Kunde inte ta bort." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Medlemmen hittades inte." }, { status: 404 });

  return NextResponse.json({ removed: true });
}
