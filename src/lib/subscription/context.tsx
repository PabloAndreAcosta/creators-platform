"use client";

import { createContext, useContext, ReactNode } from "react";
import type { MemberTier, MemberRole } from "@/types/database";

interface SubscriptionData {
  tier: MemberTier;
  role: MemberRole;
  hasActiveSubscription: boolean;
  plan: string | null;
}

const SubscriptionContext = createContext<SubscriptionData>({
  tier: "gratis",
  role: "publik",
  hasActiveSubscription: false,
  plan: null,
});

interface SubscriptionProviderProps {
  children: ReactNode;
  value: SubscriptionData;
}

export function SubscriptionProvider({ children, value }: SubscriptionProviderProps) {
  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
