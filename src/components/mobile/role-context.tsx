"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

export type UserRole = "anvandare" | "kreator" | "upplevelse";

// Map DB roles to mobile app roles
const DB_TO_APP_ROLE: Record<string, UserRole> = {
  customer: "anvandare",
  creator: "kreator",
  experience: "upplevelse",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  anvandare: "Användare",
  kreator: "Kreatör",
  upplevelse: "Upplevelse",
};

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: "anvandare",
  setRole: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("anvandare");

  useEffect(() => {
    // Load from localStorage first for instant display
    const saved = localStorage.getItem("usha-role") as UserRole | null;
    if (saved === "anvandare" || saved === "kreator" || saved === "upplevelse") {
      setRole(saved);
    }

    // Then sync from database
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data?.role) {
            const appRole = DB_TO_APP_ROLE[data.role] ?? "anvandare";
            setRole(appRole);
            localStorage.setItem("usha-role", appRole);
          }
        });
    });
  }, []);

  const handleSetRole = (newRole: UserRole) => {
    setRole(newRole);
    localStorage.setItem("usha-role", newRole);
  };

  return (
    <RoleContext.Provider value={{ role, setRole: handleSetRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
