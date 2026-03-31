"use client";

import { useState, type ReactNode } from "react";
import { useSubscription } from "@/lib/subscription/context";
import { UpgradePrompt } from "./UpgradePrompt";
import { BETA_MODE } from "@/lib/beta";
import { Lock } from "lucide-react";
import type { MemberTier } from "@/types/database";

const TIER_RANK: Record<MemberTier, number> = { gratis: 0, guld: 1, premium: 2 };

interface GatedActionProps {
  children: ReactNode;
  message?: string;
  /** Minimum tier required. Default: "guld" (anything above gratis). */
  requiredTier?: MemberTier;
  /** Show a lock icon overlay on the children. */
  showLock?: boolean;
}

/**
 * Wraps a child element (button, link, etc.) and shows an UpgradePrompt
 * if the user's tier is below the required tier.
 */
export function GatedAction({ children, message, requiredTier = "guld", showLock = false }: GatedActionProps) {
  const { tier } = useSubscription();
  const [showPrompt, setShowPrompt] = useState(false);

  const hasAccess = BETA_MODE || TIER_RANK[tier] >= TIER_RANK[requiredTier];

  if (hasAccess) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowPrompt(true);
        }}
        className="relative cursor-pointer"
      >
        <div className={showLock ? "pointer-events-none opacity-50" : ""}>
          {children}
        </div>
        {showLock && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--usha-card)] border border-[var(--usha-border)] shadow-lg">
              <Lock size={14} className="text-[var(--usha-muted)]" />
            </div>
          </div>
        )}
      </div>
      <UpgradePrompt
        open={showPrompt}
        onClose={() => setShowPrompt(false)}
        message={message}
      />
    </>
  );
}
