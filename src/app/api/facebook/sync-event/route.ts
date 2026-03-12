import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/facebook/sync-event
// Body: { listing_id }
// Pushes the listing to Facebook as a Page event (create or update)
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const { listing_id } = await req.json();
  if (!listing_id) return NextResponse.json({ error: "listing_id krävs" }, { status: 400 });

  // Get listing
  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", listing_id)
    .eq("user_id", user.id)
    .single();

  if (!listing) return NextResponse.json({ error: "Evenemang hittades inte" }, { status: 404 });

  // Get page access token
  const { data: profile } = await supabase
    .from("profiles")
    .select("facebook_page_id, facebook_page_access_token, facebook_page_name")
    .eq("id", user.id)
    .single();

  if (!profile?.facebook_page_id || !profile?.facebook_page_access_token) {
    return NextResponse.json({ error: "Ingen Facebook-sida ansluten" }, { status: 400 });
  }

  // Build event payload
  // Facebook requires start_time in ISO 8601
  // Since our listings don't have a specific event date, use tomorrow as a sensible default
  const startTime = new Date(Date.now() + 86400000).toISOString();

  const fbPayload: Record<string, string | number> = {
    name: listing.title,
    start_time: startTime,
    description: listing.description ?? "",
  };

  if (listing.price) {
    fbPayload.ticket_uri = process.env.NEXT_PUBLIC_APP_URL + `/marketplace`;
  }

  const existingFbId = listing.facebook_event_id;

  let fbRes: Response;
  let fbEventId: string;

  if (existingFbId) {
    // Update existing FB event
    fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${existingFbId}?access_token=${profile.facebook_page_access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbPayload),
      }
    );
    fbEventId = existingFbId;
  } else {
    // Create new FB event
    fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${profile.facebook_page_id}/events?access_token=${profile.facebook_page_access_token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbPayload),
      }
    );

    if (!fbRes.ok) {
      const err = await fbRes.json();
      return NextResponse.json(
        { error: "Facebook-fel: " + (err.error?.message ?? "okänt fel") },
        { status: 500 }
      );
    }

    const fbData = await fbRes.json();
    fbEventId = fbData.id;

    // Save Facebook event ID back to listing
    await supabase
      .from("listings")
      .update({ facebook_event_id: fbEventId })
      .eq("id", listing_id);
  }

  return NextResponse.json({
    success: true,
    facebook_event_id: fbEventId,
    facebook_event_url: `https://www.facebook.com/events/${fbEventId}`,
    page_name: profile.facebook_page_name,
  });
}
