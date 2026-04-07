"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";

interface PostLikeButtonProps {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
  isLoggedIn: boolean;
}

export function PostLikeButton({ postId, initialLiked, initialCount, isLoggedIn }: PostLikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const router = useRouter();

  async function handleToggle() {
    if (!isLoggedIn) {
      router.push("/login?redirect=/flode");
      return;
    }

    // Optimistic update
    setLiked(!liked);
    setCount(liked ? count - 1 : count + 1);

    try {
      const res = await fetch("/api/post-likes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      if (!res.ok) {
        // Revert
        setLiked(liked);
        setCount(count);
      }
    } catch {
      setLiked(liked);
      setCount(count);
    }
  }

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-1.5 text-sm transition"
      aria-label={liked ? "Ta bort gilla" : "Gilla"}
    >
      <Heart
        size={20}
        className={liked ? "fill-red-500 text-red-500" : "text-[var(--usha-muted)]"}
        strokeWidth={liked ? 0 : 1.5}
      />
      {count > 0 && (
        <span className={`text-xs ${liked ? "text-red-500" : "text-[var(--usha-muted)]"}`}>
          {count}
        </span>
      )}
    </button>
  );
}
