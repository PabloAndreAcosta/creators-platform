"use client";

import { useTranslations } from "next-intl";
import { useRole, UserRole } from "./role-context";
import { useToast } from "@/components/ui/toaster";
import { Lock, User, Sparkles, Compass, type LucideIcon } from "lucide-react";

const ROLES: UserRole[] = ["customer", "creator", "venue"];

const ROLE_ICONS: Record<UserRole, LucideIcon> = {
  customer: User,
  creator: Sparkles,
  venue: Compass,
};

export function RoleToggle() {
  const { role, dbRole, isAdmin, setRole } = useRole();
  const { toast } = useToast();
  const t = useTranslations("roles");
  const rt = useTranslations("roleToggle");

  const handleClick = (r: UserRole) => {
    if (r === dbRole) {
      setRole(r);
      return;
    }
    toast.info(
      rt("locked", { role: t(r) }),
      rt("lockedHint")
    );
  };

  return (
    <div className="flex items-center rounded-full border border-[var(--usha-border)] bg-[var(--usha-card)] p-0.5">
      {ROLES.map((r) => {
        const isActive = role === r;
        const isLocked = !isAdmin && r !== dbRole;
        const Icon = ROLE_ICONS[r];

        return (
          <button
            key={r}
            onClick={() => handleClick(r)}
            aria-label={
              isLocked
                ? rt("lockedLabel", { role: t(r) })
                : rt("switchTo", { role: t(r) })
            }
            aria-pressed={isActive}
            aria-disabled={isLocked}
            className={`flex items-center gap-1 rounded-full px-2 py-1.5 text-[10px] sm:px-3 sm:text-xs font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black shadow-lg"
                : isLocked
                  ? "text-[var(--usha-muted)]/40 cursor-not-allowed opacity-40"
                  : "text-[var(--usha-muted)] hover:text-white"
            }`}
          >
            {isLocked ? <Lock size={10} /> : <Icon size={12} className="sm:hidden" />}
            {/* Mobil: bara aktiv roll visar etikett (ryms i headern); desktop visar alltid */}
            <span className={isActive ? "" : "hidden sm:inline"}>{t(r)}</span>
          </button>
        );
      })}
    </div>
  );
}
