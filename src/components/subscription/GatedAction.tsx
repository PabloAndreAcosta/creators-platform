"use client";

import type { ReactNode } from "react";
import type { MemberTier } from "@/types/database";

interface GatedActionProps {
  children: ReactNode;
  message?: string;
  requiredTier?: MemberTier;
  showLock?: boolean;
}

/**
 * Förr: visade barnet gråmarkerat med lås och en uppgraderingsruta när
 * användarens nivå låg under den som krävdes. En nivå sedan 2026-11-13, så
 * det finns inget att låsa: komponenten släpper igenom barnet rakt av och
 * finns kvar bara för att anropsställena inte ska behöva skrivas om samtidigt.
 */
export function GatedAction({ children }: GatedActionProps) {
  return <>{children}</>;
}
