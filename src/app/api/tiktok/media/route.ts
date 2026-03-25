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
    .select("tiktok_access_token")
    .eq("id", user.id)
    .single();

  if (!profile?.tiktok_access_token) {
    return NextResponse.json({ error: "TikTok ej kopplat" }, { status: 400 });
  }

  const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

  const body: Record<string, unknown> = { max_count: 20 };
  if (cursor) body.cursor = parseInt(cursor, 10);

  const res = await fetch(
    "https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,embed_link",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${profile.tiktok_access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    console.error("TikTok media fetch failed:", errText);
    return NextResponse.json({ error: "Kunde inte hämta media från TikTok" }, { status: 502 });
  }

  const data = await res.json();
  const videos = data.data?.videos || [];

  const items = videos.map((v: any) => ({
    tiktok_id: v.id,
    media_type: "video" as const,
    media_url: v.share_url,
    embed_url: v.embed_link || null,
    thumbnail_url: v.cover_image_url || null,
    caption: v.title || null,
  }));

  return NextResponse.json({
    items,
    nextCursor: data.data?.has_more ? String(data.data.cursor) : null,
  });
}
