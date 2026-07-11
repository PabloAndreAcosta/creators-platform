"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { createNotification } from "@/lib/notifications/create";
import { awardPoints } from "@/lib/points/award";
import { POINT_VALUES } from "@/lib/points/constants";

export async function createPost(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  // All users with an account can post

  const text = (formData.get("text") as string)?.trim();
  const imageUrl = (formData.get("image_url") as string)?.trim() || null;
  const listingId = (formData.get("listing_id") as string)?.trim() || null;

  if (!text) return { error: "Write some text for your post" };

  // If listing_id provided, verify it belongs to the user
  if (listingId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("user_id", user.id)
      .single();

    if (!listing) return { error: "Selected service not found" };
  }

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      user_id: user.id,
      text,
      image_url: imageUrl,
      listing_id: listingId,
    })
    .select("id")
    .single();

  if (error) return { error: "Could not create post. Try again." };

  // Award points for creating a post (non-blocking)
  if (post) {
    awardPoints({
      userId: user.id,
      action: "post_created",
      points: POINT_VALUES.post_created,
      sourceId: post.id,
      sourceType: "post",
    }).catch(() => {});
  }

  // Notify followers (non-blocking)
  notifyFollowers(supabase, user.id, text).catch(() => {});

  revalidatePath("/app");
  revalidatePath("/app/posts");
  revalidatePath("/flode");
  return { success: true };
}

async function notifyFollowers(supabase: Awaited<ReturnType<typeof createClient>>, creatorId: string, postText: string) {
  const [{ data: followers }, { data: profile }] = await Promise.all([
    supabase.from("follows").select("follower_id").eq("followed_id", creatorId),
    supabase.from("profiles").select("full_name").eq("id", creatorId).single(),
  ]);

  if (!followers || followers.length === 0) return;

  const creatorName = profile?.full_name || "En kreatör";
  const preview = postText.length > 60 ? postText.slice(0, 60) + "..." : postText;

  await Promise.all(
    followers.map((f) =>
      createNotification({
        userId: f.follower_id,
        type: "new_post",
        title: `${creatorName} delade ett nytt inlägg`,
        message: preview,
        link: "/flode",
      })
    )
  );
}

export async function updatePost(postId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const text = (formData.get("text") as string)?.trim();
  const imageUrl = (formData.get("image_url") as string)?.trim() || null;
  const listingId = (formData.get("listing_id") as string)?.trim() || null;

  if (!text) return { error: "Write some text for your post" };

  if (listingId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("id")
      .eq("id", listingId)
      .eq("user_id", user.id)
      .single();
    if (!listing) return { error: "Selected service not found" };
  }

  const { error } = await supabase
    .from("posts")
    .update({ text, image_url: imageUrl, listing_id: listingId })
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: "Could not update post" };

  revalidatePath("/app");
  revalidatePath("/app/posts");
  return { success: true };
}

export async function deletePost(postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not logged in" };

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) return { error: "Could not delete post" };

  revalidatePath("/app");
  revalidatePath("/app/posts");
  return { success: true };
}

export async function getMorePosts(page: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pageSize = 20;
  const offset = page * pageSize;

  const { data: posts } = await supabase
    .from("posts")
    .select(`
      *,
      profiles!posts_user_id_fkey(id, full_name, avatar_url, category, role, is_public),
      listings(id, title, price, listing_type, event_date, event_location)
    `)
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (!posts || posts.length === 0) return { posts: [], hasMore: false };

  const postIds = posts.map((p) => p.id);

  // Get like counts
  const { data: likeCounts } = await supabase
    .from("post_likes")
    .select("post_id")
    .in("post_id", postIds);

  // Get user's likes (only if logged in)
  let userLikedSet = new Set<string>();
  if (user) {
    const { data: userLikes } = await supabase
      .from("post_likes")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", postIds);
    userLikedSet = new Set((userLikes || []).map((l) => l.post_id));
  }

  const likeCountMap: Record<string, number> = {};
  (likeCounts || []).forEach((l) => {
    likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1;
  });

  // Author levels — mirror getFeedPosts so "load more" posts show the LevelBadge too.
  const authorIds = Array.from(new Set(posts.map((p) => p.user_id)));
  const { data: authorPoints } = await supabase
    .from("user_points")
    .select("user_id, current_level")
    .in("user_id", authorIds);
  const levelMap: Record<string, number> = {};
  (authorPoints || []).forEach((up) => {
    levelMap[up.user_id] = up.current_level;
  });

  const enrichedPosts = posts.map((post) => {
    const author = (post as any).profiles || { id: post.user_id, full_name: null, avatar_url: null, category: null, role: "creator" };
    return {
      id: post.id,
      user_id: post.user_id,
      text: post.text,
      image_url: post.image_url,
      listing_id: post.listing_id,
      created_at: post.created_at,
      author: { ...author, level: levelMap[post.user_id] || 1 },
      listing: (post as any).listings || null,
      like_count: likeCountMap[post.id] || 0,
      is_liked: userLikedSet.has(post.id),
    };
  });

  return { posts: enrichedPosts, hasMore: posts.length === pageSize };
}
