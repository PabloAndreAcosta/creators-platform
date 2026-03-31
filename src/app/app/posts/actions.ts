"use server";

import { createClient } from "@/lib/supabase/server";
import type { FeedPost } from "@/types/database";

export async function getMoreMyPosts(page: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { posts: [], hasMore: false };

  const pageSize = 20;
  const offset = page * pageSize;

  const { data: posts } = await supabase
    .from("posts")
    .select(
      `
      *,
      profiles!posts_user_id_fkey(id, full_name, avatar_url, category, role),
      listings(id, title, price, listing_type, event_date, event_location)
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (!posts || posts.length === 0) return { posts: [], hasMore: false };

  const postIds = posts.map((p) => p.id);

  const [{ data: likeCounts }, { data: userLikes }] = await Promise.all([
    supabase.from("post_likes").select("post_id").in("post_id", postIds),
    supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", postIds),
  ]);

  const likeCountMap: Record<string, number> = {};
  (likeCounts || []).forEach((l) => {
    likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1;
  });
  const userLikedSet = new Set((userLikes || []).map((l) => l.post_id));

  const enrichedPosts: FeedPost[] = posts.map((post) => ({
    id: post.id,
    user_id: post.user_id,
    text: post.text,
    image_url: post.image_url,
    listing_id: post.listing_id,
    created_at: post.created_at,
    author: (post as any).profiles || {
      id: post.user_id,
      full_name: null,
      avatar_url: null,
      category: null,
      role: "kreator",
    },
    listing: (post as any).listings || null,
    like_count: likeCountMap[post.id] || 0,
    is_liked: userLikedSet.has(post.id),
  }));

  return { posts: enrichedPosts, hasMore: posts.length === pageSize };
}
