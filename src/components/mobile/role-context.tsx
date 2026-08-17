"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { normalizeRole } from "@/lib/roles";

export type UserRole = "customer" | "creator" | "venue";

/** Lagrat rollvärde → approll, med legacy-stavningar hanterade i lib/roles. */
function toAppRole(dbRole: string | null | undefined): UserRole {
  return normalizeRole(dbRole) ?? "customer";
}

// Static fallback labels (used where useTranslations is not available)
export const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Publik",
  creator: "Kreatör",
  venue: "Venue",
};

interface RoleContextType {
  role: UserRole;
  dbRole: UserRole;
  isAdmin: boolean;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: "customer",
  dbRole: "customer",
  isAdmin: false,
  setRole: () => {},
});

/**
 * Rollen kommer färdig från servern.
 *
 * Tidigare startade providern alltid på "customer" och hämtade den riktiga
 * rollen i en effekt. Serverrenderingen och första klientrenderingen visade
 * därför kundens meny för alla, och bytte sedan under fingret — en tryckning
 * som landade i glappet gick till fel sida. Att i stället läsa localStorage vid
 * start hade gett hydreringsfel, eftersom servern inte kan se den.
 *
 * Layouten hämtar redan rollen ur databasen, så vi seedar med den. Server och
 * klient renderar då samma meny direkt, utan flimmer och utan mismatch.
 * Effekten nedan är kvar men stämmer numera bara av — den initierar ingenting.
 */
export function RoleProvider({
  children,
  initialRole = "customer",
}: {
  children: ReactNode;
  initialRole?: UserRole;
}) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [dbRole, setDbRole] = useState<UserRole>(initialRole);
  // Admin-flaggan styr bara rollväxlaren, inte navigationen, och löses därför
  // fortsatt via RPC efter mount — det slipper en service-role-fråga per
  // sidladdning bara för att undvika att en knapp dyker upp en aning sent.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Stäm av mot databasen ifall rollen ändrats i en annan flik eller session.
    // Admin-flaggan läses via RPC eftersom is_admin-kolumnen inte är läsbar för
    // authenticated — ingen admin-identitet behöver ligga i klientbundlen.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      // is_admin is not readable as a column (revoked from `authenticated`); read
      // the boolean via the SECURITY DEFINER RPC so the flag never needs a column grant.
      supabase.rpc("is_current_user_admin").then(({ data }) => {
        if (data === true) setIsAdmin(true);
      });
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.role) {
            const appRole = toAppRole(data.role);
            setDbRole(appRole);
            // Skriv inte över en admin som medvetet växlat roll via RoleToggle.
            setRole((current) => (current === initialRole ? appRole : current));
            localStorage.setItem("usha-role", appRole);
          }
        });
    });
  }, [initialRole]);

  const handleSetRole = (newRole: UserRole) => {
    // Admins can switch to any role
    if (!isAdmin && newRole !== dbRole) return;
    setRole(newRole);
    localStorage.setItem("usha-role", newRole);
  };

  return (
    <RoleContext.Provider value={{ role, dbRole, isAdmin, setRole: handleSetRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
