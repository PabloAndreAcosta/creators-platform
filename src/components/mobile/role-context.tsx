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
  publik: "Publik",
  kreator: "Kreatör",
  upplevelse: "Upplevelse",
};

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
}

const RoleContext = createContext<RoleContextType>({
  role: "publik",
  setRole: () => {},
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>("publik");

  useEffect(() => {
    const saved = localStorage.getItem("usha-role") as string | null;
    // Migrate legacy "anvandare" role to "publik"
    if (saved === "anvandare") {
      localStorage.setItem("usha-role", "publik");
      setRole("publik");
    } else if (saved === "publik" || saved === "kreator" || saved === "upplevelse") {
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
            const appRole = DB_TO_APP_ROLE[data.role] ?? "publik";
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
