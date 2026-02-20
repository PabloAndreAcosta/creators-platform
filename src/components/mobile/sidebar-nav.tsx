"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Calendar,
  Ticket,
  BookOpen,
  User,
  Building2,
} from "lucide-react";
import { useRole } from "./role-context";

export function SidebarNav() {
  const pathname = usePathname();
  const { role } = useRole();

  const tabs =
    role === "anvandare"
      ? [
          { href: "/app", label: "Hem", icon: Home },
          { href: "/app/calendar", label: "Kalender", icon: Calendar },
          { href: "/app/tickets", label: "Biljetter", icon: Ticket },
          { href: "/app/profile", label: "Profil", icon: User },
        ]
      : role === "kreator"
        ? [
            { href: "/app", label: "Hem", icon: Home },
            { href: "/app/calendar", label: "Kalender", icon: Calendar },
            { href: "/app/courses", label: "Kurser", icon: BookOpen },
            { href: "/app/profile", label: "Profil", icon: User },
          ]
        : [
            { href: "/app", label: "Hem", icon: Home },
            { href: "/app/calendar", label: "Kalender", icon: Calendar },
            { href: "/app/events", label: "Evenemang", icon: Building2 },
            { href: "/app/profile", label: "Profil", icon: User },
          ];

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-shrink-0 sticky top-0 h-screen flex-col justify-center border-r border-[var(--usha-border)] bg-[var(--usha-black)]">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-6 pb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
          <span className="text-sm font-bold text-black">U</span>
        </div>
        <span className="text-xl font-bold tracking-tight">Usha</span>
      </div>

      {/* Navigation */}
      <nav className="space-y-0.5 px-4">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]"
                  : "text-[var(--usha-muted)] hover:bg-[var(--usha-card)] hover:text-white"
              }`}
            >
              <tab.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
