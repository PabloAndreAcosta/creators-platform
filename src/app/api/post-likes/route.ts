import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await req.json();
  if (!postId) {
    return NextResponse.json({ error: "postId krävs" }, { status: 400 });
  }

  // Check if already liked
  const { data: existing } = await supabase
    .from("post_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .single();

  if (existing) {
    await supabase.from("post_likes").delete().eq("id", existing.id);
    return NextResponse.json({ liked: false });
  } else {
    const { error } = await supabase
      .from("post_likes")
      .insert({ user_id: user.id, post_id: postId });
    if (error) {
      return NextResponse.json({ error: "Kunde inte gilla inlägget" }, { status: 500 });
    }
    return NextResponse.json({ liked: true });
  }
}
