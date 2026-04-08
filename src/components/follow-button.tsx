"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";

interface FollowButtonProps {
  creatorId: string;
  initialFollowing: boolean;
  followerCount: number;
  isLoggedIn: boolean;
}

export function FollowButton({
  creatorId,
  initialFollowing,
  followerCount,
  isLoggedIn,
}: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(followerCount);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    if (!isLoggedIn) {
      router.push(`/login?redirect=/creators/${creatorId}`);
      return;
    }

    setLoading(true);
    // Optimistic update
    setFollowing(!following);
    setCount(following ? count - 1 : count + 1);

    try {
      const res = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorId }),
      });

      if (!res.ok) {
        // Revert
        setFollowing(following);
        setCount(count);
      }
    } catch {
      setFollowing(following);
      setCount(count);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition ${
        following
          ? "border border-[var(--usha-gold)]/30 text-[var(--usha-gold)] hover:border-red-500/30 hover:text-red-400"
          : "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black hover:opacity-90"
      } disabled:opacity-60`}
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : following ? (
        <UserCheck size={14} />
      ) : (
        <UserPlus size={14} />
      )}
      {following ? "Följer" : "Följ"}
      {count > 0 && (
        <span className={`text-xs ${following ? "text-[var(--usha-muted)]" : "text-black/60"}`}>
          · {count}
        </span>
      )}
    </button>
  );
}
