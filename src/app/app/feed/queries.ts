import { createClient } from "@/lib/supabase/server";
import type { FeedPost } from "@/types/database";

export async function getFeedPosts(
  userId?: string,
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

  // Get current user's likes (only if logged in)
  let userLikedSet = new Set<string>();
  if (userId) {
    const { data: userLikes } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds);
    userLikedSet = new Set((userLikes || []).map((l) => l.post_id));
  }

  const likeCountMap: Record<string, number> = {};
  (likeCounts || []).forEach((l) => {
    likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1;
  });

  // Get user levels for post authors
  const authorIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: authorPoints } = await supabase
    .from("user_points")
    .select("user_id, current_level")
    .in("user_id", authorIds);

  const levelMap: Record<string, number> = {};
  (authorPoints || []).forEach((up) => {
    levelMap[up.user_id] = up.current_level;
  });

  return posts.map((post) => {
    const author = (post as any).profiles || {
      id: post.user_id,
      full_name: null,
      avatar_url: null,
      category: null,
      role: "kreator",
    };
    return {
      id: post.id,
      user_id: post.user_id,
      text: post.text,
      image_url: post.image_url,
      listing_id: post.listing_id,
      created_at: post.created_at,
      author: {
        ...author,
        level: levelMap[post.user_id] || 1,
      },
      listing: (post as any).listings || null,
      like_count: likeCountMap[post.id] || 0,
      is_liked: userLikedSet.has(post.id),
    };
  });
}
