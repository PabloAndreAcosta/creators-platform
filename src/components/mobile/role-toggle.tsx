"use client";

import { useRole, UserRole, ROLE_LABELS } from "./role-context";

const ROLES: UserRole[] = ["anvandare", "kreator", "upplevelse"];

export function RoleToggle() {
  const { role, setRole } = useRole();

  return (
    <div className="flex items-center rounded-full border border-[var(--usha-border)] bg-[var(--usha-card)] p-0.5">
      {ROLES.map((r) => (
        <button
          key={r}
          onClick={() => setRole(r)}
          className={`rounded-full px-3 py-1.5 text-[10px] font-medium transition-all ${
            role === r
              ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black shadow-lg"
              : "text-[var(--usha-muted)] hover:text-white"
          }`}
        >
          {ROLE_LABELS[r]}
        </button>
      ))}
    </div>
  );
}
