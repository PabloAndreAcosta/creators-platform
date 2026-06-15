"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "customer" | "creator" | "venue";

// Map DB roles to mobile app roles
const DB_TO_APP_ROLE: Record<string, UserRole> = {
  publik: "customer",
  customer: "customer",
  creator: "creator",
  kreator: "creator",
  experience: "venue",
  upplevelse: "venue",
};

// Static fallback labels (used where useTranslations is not available)
export const ROLE_LABELS: Record<UserRole, string> = {
  customer: "Användare",
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

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("customer");
  const [dbRole, setDbRole] = useState<UserRole>("customer");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Sync from database — this is the source of truth. Admin status comes from
    // the protected profiles.is_admin column (not a client-side email list), so
    // no admin identities need to be shipped in the public bundle.
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("role, is_admin")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.is_admin === true) {
            setIsAdmin(true);
          }
          if (data?.role) {
            const appRole = DB_TO_APP_ROLE[data.role] ?? "customer";
            setDbRole(appRole);
            setRole(appRole);
            localStorage.setItem("usha-role", appRole);
          }
        });
    });
  }, []);

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
