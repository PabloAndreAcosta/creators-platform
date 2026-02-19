"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UserRole = "anvandare" | "kreator" | "upplevelse";

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
    const saved = localStorage.getItem("usha-role") as UserRole | null;
    if (saved === "anvandare" || saved === "kreator" || saved === "upplevelse") {
      setRole(saved);
    }
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
