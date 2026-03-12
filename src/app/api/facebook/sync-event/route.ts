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

  // Build page post payload (Facebook deprecated the Page Events API,
  // so we publish as a page post instead)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://usha.se";
  const priceText = listing.price ? `\n💰 Pris: ${listing.price} SEK` : "\n🆓 Gratis";
  const message = `${listing.title}\n\n${listing.description ?? ""}${priceText}\n\n👉 Boka här: ${appUrl}/marketplace`;

  const existingFbId = listing.facebook_event_id;

  let fbRes: Response;
  let fbPostId: string;

  if (existingFbId) {
    // Update existing post
    fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${existingFbId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          access_token: profile.facebook_page_access_token,
        }),
      }
    );
    fbPostId = existingFbId;
  } else if (listing.image_url) {
    // Create new photo post with image
    fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${profile.facebook_page_id}/photos`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: listing.image_url,
          message,
          access_token: profile.facebook_page_access_token,
        }),
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
    fbPostId = fbData.post_id || fbData.id;

    // Save Facebook post ID back to listing
    await supabase
      .from("listings")
      .update({ facebook_event_id: fbPostId })
      .eq("id", listing_id);
  } else {
    // Create new page post (text only)
    fbRes = await fetch(
      `https://graph.facebook.com/v19.0/${profile.facebook_page_id}/feed`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          access_token: profile.facebook_page_access_token,
        }),
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
    fbPostId = fbData.id;

    // Save Facebook post ID back to listing
    await supabase
      .from("listings")
      .update({ facebook_event_id: fbPostId })
      .eq("id", listing_id);
  }

  return NextResponse.json({
    success: true,
    facebook_event_id: fbPostId,
    facebook_event_url: `https://www.facebook.com/${fbPostId}`,
    page_name: profile.facebook_page_name,
  });
}
