"use client";

import { useState } from "react";
import Link from "next/link";
import { Ticket, Calendar, MapPin } from "lucide-react";
import { PostLikeButton } from "./post-like-button";
import type { FeedPost } from "@/types/database";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "nu";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}

const ROLE_LABELS: Record<string, string> = {
  creator: "Kreatör",
  kreator: "Kreatör",
  experience: "Upplevelse",
  upplevelse: "Upplevelse",
};

interface PostCardProps {
  post: FeedPost;
  isLoggedIn: boolean;
}

export function PostCard({ post, isLoggedIn }: PostCardProps) {
  const [expanded, setExpanded] = useState(false);
  const isLong = post.text.length > 150;

  return (
    <div className="border-b border-[var(--usha-border)] pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/creators/${post.author.id}`}>
          {post.author.avatar_url ? (
            <img
              src={post.author.avatar_url}
              alt=""
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
              <span className="text-sm font-bold text-[var(--usha-gold)]">
                {(post.author.full_name || "?")[0]}
              </span>
            </div>
          )}
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Link href={`/creators/${post.author.id}`} className="text-sm font-semibold hover:underline">
              {post.author.full_name || "Kreatör"}
            </Link>
            <span className="rounded-full bg-[var(--usha-gold)]/10 px-1.5 py-0.5 text-[9px] font-medium text-[var(--usha-gold)]">
              {ROLE_LABELS[post.author.role] || "Kreatör"}
            </span>
          </div>
          <p className="text-[10px] text-[var(--usha-muted)]">
            {post.author.category ? `${post.author.category} · ` : ""}{timeAgo(post.created_at)}
          </p>
        </div>
      </div>

      {/* Image */}
      {post.image_url && (
        <div className="relative">
          <img
            src={post.image_url}
            alt=""
            className="w-full max-h-[500px] object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 pt-3">
        <PostLikeButton
          postId={post.id}
          initialLiked={post.is_liked}
          initialCount={post.like_count}
          isLoggedIn={isLoggedIn}
        />
      </div>

      {/* Text */}
      <div className="px-4 pt-2">
        <p className="text-sm leading-relaxed">
          <Link href={`/creators/${post.author.id}`} className="font-semibold hover:underline">
            {(post.author.full_name || "Kreatör").split(" ")[0]}
          </Link>{" "}
          {isLong && !expanded ? (
            <>
              {post.text.slice(0, 150)}...{" "}
              <button
                onClick={() => setExpanded(true)}
                className="text-[var(--usha-muted)] hover:text-white"
              >
                visa mer
              </button>
            </>
          ) : (
            post.text
          )}
        </p>
      </div>

      {/* CTA — linked listing */}
      {post.listing && (
        <div className="mx-4 mt-3">
          <Link
            href={`/creators/${post.author.id}`}
            className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 transition hover:border-[var(--usha-gold)]/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
              <Ticket size={16} className="text-[var(--usha-gold)]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{post.listing.title}</p>
              <div className="flex items-center gap-2 text-[10px] text-[var(--usha-muted)]">
                {post.listing.event_date && (
                  <span className="flex items-center gap-0.5">
                    <Calendar size={9} />
                    {new Date(post.listing.event_date).toLocaleDateString("sv-SE", { day: "numeric", month: "short" })}
                  </span>
                )}
                {post.listing.event_location && (
                  <span className="flex items-center gap-0.5">
                    <MapPin size={9} />
                    {post.listing.event_location}
                  </span>
                )}
              </div>
            </div>
            <span className="rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-1.5 text-xs font-bold text-black">
              {post.listing.price ? `${post.listing.price} kr` : "Gratis"}
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
