import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/facebook/import-events
// Fetches upcoming events from the connected Facebook Page
// and creates listings for any that don't already exist
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("facebook_page_id, facebook_page_access_token")
    .eq("id", user.id)
    .single();

  if (!profile?.facebook_page_id || !profile?.facebook_page_access_token) {
    return NextResponse.json({ error: "Ingen Facebook-sida ansluten" }, { status: 400 });
  }

  // Fetch upcoming events from the Facebook Page
  const fbRes = await fetch(
    `https://graph.facebook.com/v19.0/${profile.facebook_page_id}/events?` +
      new URLSearchParams({
        access_token: profile.facebook_page_access_token,
        fields: "id,name,description,start_time,ticket_uri",
        time_filter: "upcoming",
        limit: "25",
      })
  );

  if (!fbRes.ok) {
    const err = await fbRes.json();
    return NextResponse.json(
      { error: "Facebook-fel: " + (err.error?.message ?? "okänt fel") },
      { status: 500 }
    );
  }

  const fbData = await fbRes.json();
  const fbEvents: Array<{
    id: string;
    name: string;
    description?: string;
    start_time: string;
  }> = fbData.data ?? [];

  // Get existing listings with facebook_event_id to avoid duplicates
  const { data: existingListings } = await supabase
    .from("listings")
    .select("facebook_event_id")
    .eq("user_id", user.id)
    .not("facebook_event_id", "is", null);

  const existingFbIds = new Set(
    (existingListings ?? []).map((l) => l.facebook_event_id)
  );

  const newEvents = fbEvents.filter((e) => !existingFbIds.has(e.id));

  if (newEvents.length === 0) {
    return NextResponse.json({ imported: 0, message: "Inga nya evenemang att importera" });
  }

  // Insert new listings for each imported Facebook event
  const inserts = newEvents.map((e) => ({
    user_id: user.id,
    title: e.name,
    description: e.description ?? null,
    category: "other",
    facebook_event_id: e.id,
    is_active: true,
  }));

  const { error } = await supabase.from("listings").insert(inserts);

  if (error) {
    return NextResponse.json({ error: "Kunde inte spara importerade evenemang" }, { status: 500 });
  }

  return NextResponse.json({
    imported: newEvents.length,
    events: newEvents.map((e) => ({ id: e.id, name: e.name })),
  });
}
