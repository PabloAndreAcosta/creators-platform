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
    .select("instagram_user_id, instagram_access_token")
    .eq("id", user.id)
    .single();

  if (!profile?.instagram_user_id || !profile?.instagram_access_token) {
    return NextResponse.json({ error: "Instagram ej kopplat" }, { status: 400 });
  }

  const after = req.nextUrl.searchParams.get("after") || "";
  const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
  let url = `https://graph.instagram.com/v19.0/me/media?fields=${fields}&limit=25&access_token=${profile.instagram_access_token}`;
  if (after) url += `&after=${after}`;

  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text();
    console.error("Instagram media fetch failed:", errText);
    return NextResponse.json({ error: "Kunde inte hämta media från Instagram" }, { status: 502 });
  }

  const data = await res.json();

  const items = await Promise.all(
    (data.data || []).map(async (item: any) => {
      // For carousel albums, fetch children
      if (item.media_type === "CAROUSEL_ALBUM") {
        const childRes = await fetch(
          `https://graph.instagram.com/v19.0/${item.id}/children?fields=media_type,media_url,thumbnail_url&access_token=${profile.instagram_access_token}`
        );
        if (childRes.ok) {
          const childData = await childRes.json();
          return (childData.data || []).map((child: any) => ({
            ig_id: child.id,
            media_type: child.media_type === "VIDEO" ? "video" : "image",
            media_url: child.media_url,
            thumbnail_url: child.thumbnail_url || null,
            caption: item.caption || null,
            permalink: item.permalink,
          }));
        }
      }

      return [{
        ig_id: item.id,
        media_type: item.media_type === "VIDEO" ? "video" : "image",
        media_url: item.media_url,
        thumbnail_url: item.thumbnail_url || null,
        caption: item.caption || null,
        permalink: item.permalink,
      }];
    })
  );

  return NextResponse.json({
    items: items.flat(),
    nextCursor: data.paging?.cursors?.after || null,
  });
}
