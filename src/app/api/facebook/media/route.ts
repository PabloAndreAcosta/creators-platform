import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
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
    return NextResponse.json({ error: "Facebook ej kopplat" }, { status: 400 });
  }

  const after = req.nextUrl.searchParams.get("after") || "";
  const token = profile.facebook_page_access_token;
  const pageId = profile.facebook_page_id;

  // Fetch photos from the page
  let url = `https://graph.facebook.com/v19.0/${pageId}/photos?fields=id,images,name,created_time&type=uploaded&limit=25&access_token=${token}`;
  if (after) url += `&after=${after}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    console.error("Facebook media fetch failed:", errText);
    return NextResponse.json({ error: "Kunde inte hämta media från Facebook" }, { status: 502 });
  }

  const data = await res.json();

  const items = (data.data || []).map((item: any) => {
    // images is an array sorted by size (largest first)
    const bestImage = item.images?.[0]?.source || null;
    const thumbnail = item.images?.[item.images.length - 1]?.source || bestImage;

    return {
      fb_id: item.id,
      media_type: "image" as const,
      media_url: bestImage,
      thumbnail_url: thumbnail,
      caption: item.name || null,
    };
  });

  return NextResponse.json({
    items,
    nextCursor: data.paging?.cursors?.after || null,
  });
}
