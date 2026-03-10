"use client";

import { useState, type ReactNode } from "react";
import { useSubscription } from "@/lib/subscription/context";
import { UpgradePrompt } from "./UpgradePrompt";

interface GatedActionProps {
  children: ReactNode;
  message?: string;
}

/**
 * Wraps a child element (button, link, etc.) and shows an UpgradePrompt
 * instead of the normal action if the user is on the Gratis tier.
 */
export function GatedAction({ children, message }: GatedActionProps) {
  const { tier } = useSubscription();
  const [showPrompt, setShowPrompt] = useState(false);

  if (tier !== "gratis") {
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
        className="cursor-pointer"
      >
        {children}
      </div>
      <UpgradePrompt
        open={showPrompt}
        onClose={() => setShowPrompt(false)}
        message={message}
      />
    </>
  );
}
