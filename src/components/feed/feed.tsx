"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { PostCard } from "./post-card";
import { getMorePosts } from "@/app/app/feed/actions";
import type { FeedPost } from "@/types/database";

interface FeedProps {
  initialPosts: FeedPost[];
  isLoggedIn: boolean;
  currentUserId?: string;
}

export function Feed({ initialPosts, isLoggedIn, currentUserId }: FeedProps) {
  const t = useTranslations("feed");
  const tc = useTranslations("common");
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length >= 20);
  const [loading, setLoading] = useState(false);

  // Sync with server data when initialPosts changes (e.g. after revalidation)
  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

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
        <p className="text-sm font-medium">{t("empty")}</p>
        <p className="mt-1 text-xs text-[var(--usha-muted)]">
          {t("emptyHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} isLoggedIn={isLoggedIn} currentUserId={currentUserId} />
      ))}

      {hasMore && (
        <div className="py-4 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-6 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : null}
            {loading ? tc("loading") : tc("showMore")}
          </button>
        </div>
      )}
    </div>
  );
}
