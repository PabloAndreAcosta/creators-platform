"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { PostCard } from "@/components/feed/post-card";
import { CreatePostForm } from "@/components/feed/create-post-form";
import { getMoreMyPosts } from "./actions";
import type { FeedPost } from "@/types/database";

interface MyPostsContentProps {
  profile: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string | null;
    category: string | null;
  };
  listings: { id: string; title: string }[];
  initialPosts: FeedPost[];
}

export function MyPostsContent({
  profile,
  listings,
  initialPosts,
}: MyPostsContentProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    const result = await getMoreMyPosts(page);
    setPosts((prev) => [...prev, ...result.posts]);
    setHasMore(result.hasMore);
    setPage((p) => p + 1);
    setLoading(false);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="mb-6 text-xl font-bold">Mina inlägg</h1>

      {/* Create new post */}
      <div className="mb-6">
        <CreatePostForm
          authorName={profile.full_name || "Kreatör"}
          authorAvatar={profile.avatar_url}
          listings={listings}
        />
      </div>

      {/* Posts list */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--usha-card)]">
            <FileText size={24} className="text-[var(--usha-muted)]" />
          </div>
          <p className="text-sm text-[var(--usha-muted)]">
            Du har inga inlägg ännu. Dela din första uppdatering!
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              isLoggedIn={true}
              currentUserId={profile.id}
            />
          ))}

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm text-[var(--usha-muted)] transition hover:text-white"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Visa fler"
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
