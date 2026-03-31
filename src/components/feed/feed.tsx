"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { PostCard } from "./post-card";
import { getMorePosts } from "@/app/app/feed/actions";
import type { FeedPost } from "@/types/database";

interface FeedProps {
  initialPosts: FeedPost[];
  isLoggedIn: boolean;
}

export function Feed({ initialPosts, isLoggedIn }: FeedProps) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    const result = await getMorePosts(page);
    if (result.posts.length > 0) {
      setPosts([...posts, ...result.posts]);
      setPage(page + 1);
    }
    setHasMore(result.hasMore);
    setLoading(false);
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-16 text-center">
        <p className="text-sm font-medium">Inga inlägg att visa just nu</p>
        <p className="mt-1 text-xs text-[var(--usha-muted)]">
          Följ kreatörer och upplevelser för att se deras uppdateringar
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} isLoggedIn={isLoggedIn} />
      ))}

      {hasMore && (
        <div className="py-4 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-6 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? "Laddar..." : "Visa fler"}
          </button>
        </div>
      )}
    </div>
  );
}
