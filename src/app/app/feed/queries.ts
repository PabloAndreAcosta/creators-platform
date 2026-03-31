import { createClient } from "@/lib/supabase/server";
import type { FeedPost } from "@/types/database";

export async function getFeedPosts(
  userId: string,
  page = 0,
  pageSize = 20
): Promise<FeedPost[]> {
  const supabase = await createClient();
  const offset = page * pageSize;

  const { data: posts } = await supabase
    .from("posts")
    .select(`
      *,
      profiles!posts_user_id_fkey(id, full_name, avatar_url, category, role),
      listings(id, title, price, listing_type, event_date, event_location)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (!posts || posts.length === 0) return [];

  const postIds = posts.map((p) => p.id);

  // Get like counts
  const { data: likeCounts } = await supabase
    .from("post_likes")
    .select("post_id")
    .in("post_id", postIds);

  // Get current user's likes
  const { data: userLikes } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("user_id", userId)
    .in("post_id", postIds);

  const likeCountMap: Record<string, number> = {};
  (likeCounts || []).forEach((l) => {
    likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1;
  });
  const userLikedSet = new Set((userLikes || []).map((l) => l.post_id));

  return posts.map((post) => ({
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
}
