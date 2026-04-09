import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { awardPoints } from "@/lib/points/award";
import { POINT_VALUES } from "@/lib/points/constants";

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
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
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
    const { data: like, error } = await supabase
      .from("post_likes")
      .insert({ user_id: user.id, post_id: postId })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: "Could not like post" }, { status: 500 });
    }

    // Award points (non-blocking)
    const { data: post } = await supabase
      .from("posts")
      .select("user_id")
      .eq("id", postId)
      .single();

    if (like) {
      awardPoints({
        userId: user.id,
        action: "like_given",
        points: POINT_VALUES.like_given,
        sourceId: like.id,
        sourceType: "post_like",
      }).catch(() => {});

      if (post && post.user_id !== user.id) {
        awardPoints({
          userId: post.user_id,
          action: "like_received",
          points: POINT_VALUES.like_received,
          sourceId: like.id,
          sourceType: "post_like",
        }).catch(() => {});
      }
    }

    return NextResponse.json({ liked: true });
  }
}
