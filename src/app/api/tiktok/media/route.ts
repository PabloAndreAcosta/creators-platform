import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getValidTikTokAccessToken } from "@/lib/social/tiktok-token";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });

  const { data: social } = await supabase
    .from("social_connections")
    .select("tiktok_access_token, tiktok_refresh_token, tiktok_token_expires_at")
    .eq("user_id", user.id)
    .single();

  // Access-tokenet lever bara 24h. Förnya det här i stället för att låta
  // användaren möta ett 401 och koppla om varje dygn.
  const token = await getValidTikTokAccessToken(supabase, user.id, {
    accessToken: social?.tiktok_access_token ?? null,
    refreshToken: social?.tiktok_refresh_token ?? null,
    expiresAt: social?.tiktok_token_expires_at ?? null,
  });

  if (!token.ok) {
    return token.needsReconnect
      ? NextResponse.json(
          { error: "TikTok-kopplingen behöver förnyas. Koppla om under Inställningar → Kopplingar." },
          { status: 400 }
        )
      : NextResponse.json(
          { error: "Kunde inte nå TikTok just nu. Försök igen om en stund." },
          { status: 503 }
        );
  }

  const cursor = req.nextUrl.searchParams.get("cursor") || undefined;

  const body: Record<string, unknown> = { max_count: 20 };
  if (cursor) body.cursor = parseInt(cursor, 10);

  const res = await fetch(
    "https://open.tiktokapis.com/v2/video/list/?fields=id,title,cover_image_url,share_url,embed_link",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
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
