"use client";

import { useState, useEffect } from "react";
import { Loader2, ArrowRight } from "lucide-react";
import { PostCard } from "./post-card";
import { getMorePosts } from "@/app/app/feed/actions";
import type { FeedPost } from "@/types/database";

export function FeedPreview() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMorePosts(0).then((result) => {
      setPosts(result.posts.slice(0, 6));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[var(--usha-gold)]" />
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <div>
      <div className="space-y-2">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} isLoggedIn={false} />
        ))}
      </div>

      <div className="py-6 text-center">
        <a
          href="/flode"
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-6 py-2.5 text-sm font-medium text-[var(--usha-muted)] transition hover:border-[var(--usha-gold)]/30 hover:text-white"
        >
          Se fler i flödet
          <ArrowRight size={14} />
        </a>
      </div>
    </div>
  );
}
