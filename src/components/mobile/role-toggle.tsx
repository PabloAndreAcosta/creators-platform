"use client";

import { useRole, UserRole, ROLE_LABELS } from "./role-context";
import { useToast } from "@/components/ui/toaster";
import { Lock } from "lucide-react";

const ROLES: UserRole[] = ["publik", "kreator", "upplevelse"];

export function RoleToggle() {
  const { role, dbRole, setRole } = useRole();
  const { toast } = useToast();

  const handleClick = (r: UserRole) => {
    if (r === dbRole) {
      setRole(r);
      return;
    }
    toast.info(
      `${ROLE_LABELS[r]} är låst`,
      "Gå till Profil > Uppgradera för att byta roll"
    );
  };

  return (
    <div className="flex items-center rounded-full border border-[var(--usha-border)] bg-[var(--usha-card)] p-0.5">
      {ROLES.map((r) => {
        const isActive = role === r;
        const isLocked = r !== dbRole;

        return (
          <button
            key={r}
            onClick={() => handleClick(r)}
            aria-label={
              isLocked
                ? `${ROLE_LABELS[r]} – låst`
                : `Byt till ${ROLE_LABELS[r]}-vy`
            }
            aria-pressed={isActive}
            aria-disabled={isLocked}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 text-[10px] sm:text-xs font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black shadow-lg"
                : isLocked
                  ? "text-[var(--usha-muted)]/40 cursor-not-allowed opacity-40"
                  : "text-[var(--usha-muted)] hover:text-white"
            }`}
          >
            {isLocked && <Lock size={10} />}
            {ROLE_LABELS[r]}
          </button>
        );
      })}
    </div>
  );
}
