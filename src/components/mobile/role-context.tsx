"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "publik" | "kreator" | "upplevelse";

// Map DB roles to mobile app roles
const DB_TO_APP_ROLE: Record<string, UserRole> = {
  publik: "publik",
  customer: "publik",
  creator: "kreator",
  kreator: "kreator",
  experience: "upplevelse",
  upplevelse: "upplevelse",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  publik: "Användare",
  kreator: "Kreatör",
  upplevelse: "Upplevelse",
};

interface RoleContextType {
  role: UserRole;
  dbRole: UserRole;
  isAdmin: boolean;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: "publik",
  dbRole: "publik",
  isAdmin: false,
  setRole: () => {},
});

import { isAdmin as checkIsAdmin } from "@/lib/config";

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("publik");
  const [dbRole, setDbRole] = useState<UserRole>("publik");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Sync from database — this is the source of truth
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      if (checkIsAdmin(user.email)) {
        setIsAdmin(true);
      }
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.role) {
            const appRole = DB_TO_APP_ROLE[data.role] ?? "publik";
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
