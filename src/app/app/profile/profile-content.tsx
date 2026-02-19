"use client";

import { useRole } from "@/components/mobile/role-context";
import {
  User,
  Edit2,
  CreditCard,
  Bell,
  Shield,
  HelpCircle,
  LogOut,
  ChevronRight,
  Star,
  Calendar,
  Heart,
  BookOpen,
  Users,
  DollarSign,
  Award,
  Building2,
  Ticket,
} from "lucide-react";

interface ProfileContentProps {
  profile: any;
  email: string;
  listingsCount: number;
  bookingsCount: number;
}

export function ProfileContent({
  profile,
  email,
  listingsCount,
  bookingsCount,
}: ProfileContentProps) {
  const { role } = useRole();

  return (
    <div className="px-4 py-6 space-y-6">
      {/* Avatar & Name */}
      <div className="flex flex-col items-center">
        <div className="relative mb-3">
          <div className="h-20 w-20 rounded-full border-2 border-[var(--usha-gold)] p-0.5">
            <div className="flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
              <span className="text-2xl font-bold text-[var(--usha-gold)]">
                {(profile?.full_name || "U")[0]}
              </span>
            </div>
          </div>
          {role === "kreator" && (
            <div className="absolute -bottom-1 -right-1 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] p-1">
              <Award size={12} className="text-black" />
            </div>
          )}
        </div>
        <h1 className="text-xl font-bold">
          {profile?.full_name || "Användare"}
        </h1>
        <p className="text-sm text-[var(--usha-muted)]">{email}</p>
        {profile?.category && (
          <p className="mt-0.5 text-xs text-[var(--usha-gold)]">
            {role === "kreator" ? "Kreatör" : role === "upplevelse" ? "Upplevelse" : "Användare"} · {profile.category}
          </p>
        )}
      </div>

      {/* Membership card */}
      <div className="rounded-2xl bg-gradient-to-br from-[var(--usha-gold)]/20 via-[var(--usha-gold)]/10 to-[var(--usha-accent)]/10 border border-[var(--usha-gold)]/30 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-bold text-[var(--usha-gold)]">
            {role === "kreator"
              ? "Topp Kreatör"
              : role === "upplevelse"
                ? "Premium Venue"
                : "Gold Medlem"}
          </span>
          <Star size={16} className="fill-[var(--usha-gold)] text-[var(--usha-gold)]" />
        </div>
        <p className="text-xs text-[var(--usha-muted)]">
          Medlem sedan{" "}
          {profile?.created_at
            ? new Date(profile.created_at).toLocaleDateString("sv", {
                month: "long",
                year: "numeric",
              })
            : "nyligen"}
        </p>
        <p className="mt-1 text-xs text-[var(--usha-gold)]">
          Poäng: {role === "kreator" ? "8,240" : role === "upplevelse" ? "12,500" : "2,450"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {role === "anvandare" && (
          <>
            <StatBox icon={Calendar} label="Evenemang" value={String(bookingsCount || 12)} />
            <StatBox icon={BookOpen} label="Kurser" value="3" />
            <StatBox icon={Heart} label="Favoriter" value="8" />
          </>
        )}
        {role === "kreator" && (
          <>
            <StatBox icon={BookOpen} label="Kurser" value={String(listingsCount || 8)} />
            <StatBox icon={Users} label="Elever" value="156" />
            <StatBox icon={Star} label="Betyg" value="4.8" />
          </>
        )}
        {role === "upplevelse" && (
          <>
            <StatBox icon={Ticket} label="Evenemang" value={String(listingsCount || 12)} />
            <StatBox icon={Users} label="Besökare" value="1,240" />
            <StatBox icon={Star} label="Betyg" value="4.6" />
          </>
        )}
      </div>

      {/* Revenue card (for creator and venue) */}
      {(role === "kreator" || role === "upplevelse") && (
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[var(--usha-muted)]">Intäkter denna månad</p>
              <p className="text-2xl font-bold">
                {role === "kreator" ? "15,600" : "45,200"} kr
              </p>
            </div>
            <DollarSign size={24} className="text-[var(--usha-gold)]" />
          </div>
        </div>
      )}

      {/* Settings list */}
      <div className="space-y-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
        <SettingsRow icon={Edit2} label="Redigera Profil" href="/dashboard/profile" />
        <SettingsRow icon={CreditCard} label="Betalningsmetoder" href="/dashboard/billing" />
        <SettingsRow icon={Bell} label="Notifikationer" />
        <SettingsRow icon={Shield} label="Integritetsinställningar" />
        <SettingsRow icon={HelpCircle} label="Hjälp & Support" />
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-red-400 transition-colors hover:bg-[var(--usha-card-hover)]"
          >
            <LogOut size={18} />
            <span className="flex-1 text-sm font-medium">Logga ut</span>
          </button>
        </form>
      </div>
    </div>
  );
}

function StatBox({
  icon: Icon,
  label,
  value,
}: {
  icon: any;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-center">
      <Icon size={18} className="mx-auto mb-1 text-[var(--usha-gold)]" />
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] text-[var(--usha-muted)]">{label}</p>
    </div>
  );
}

function SettingsRow({
  icon: Icon,
  label,
  href,
}: {
  icon: any;
  label: string;
  href?: string;
}) {
  const inner = (
    <>
      <Icon size={18} className="text-[var(--usha-muted)]" />
      <span className="flex-1 text-sm font-medium">{label}</span>
      <ChevronRight size={16} className="text-[var(--usha-muted)]" />
    </>
  );

  if (href) {
    return (
      <a
        href={href}
        className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--usha-card-hover)]"
      >
        {inner}
      </a>
    );
  }

  return (
    <button className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--usha-card-hover)]">
      {inner}
    </button>
  );
}
