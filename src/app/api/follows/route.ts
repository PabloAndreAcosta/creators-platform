import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ following: [] });

  const { data } = await supabase
    .from("follows")
    .select("followed_id")
    .eq("follower_id", user.id);

  return NextResponse.json({
    following: (data || []).map((f) => f.followed_id),
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Ej inloggad" }, { status: 401 });
  }

  const { creatorId } = await req.json();
  if (!creatorId) {
    return NextResponse.json({ error: "creatorId krävs" }, { status: 400 });
  }

  if (creatorId === user.id) {
    return NextResponse.json({ error: "Du kan inte följa dig själv" }, { status: 400 });
  }

  // Check if already following
  const { data: existing } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", user.id)
    .eq("followed_id", creatorId)
    .single();

  if (existing) {
    // Unfollow
    await supabase
      .from("follows")
      .delete()
      .eq("follower_id", user.id)
      .eq("followed_id", creatorId);

    return NextResponse.json({ following: false });
  }

  // Follow
  const { error } = await supabase.from("follows").insert({
    follower_id: user.id,
    followed_id: creatorId,
  });

  if (error) {
    return NextResponse.json({ error: "Kunde inte följa" }, { status: 500 });
  }

  return NextResponse.json({ following: true });
}
