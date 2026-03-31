"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Ticket,
  BookOpen,
  User,
  Building2,
  MessageCircle,
  ScanLine,
} from "lucide-react";
import { useRole } from "./role-context";
import { useSubscription } from "@/lib/subscription/context";

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useRole();
  const { tier } = useSubscription();

  const tabs =
    role === "publik"
      ? [
          { href: "/app", label: "Hem", icon: Home },
          { href: "/app/messages", label: "Meddelanden", icon: MessageCircle },
          { href: "/app/tickets", label: "Biljetter", icon: Ticket },
          { href: "/app/profile", label: "Profil", icon: User },
        ]
      : role === "kreator"
        ? [
            { href: "/app", label: "Hem", icon: Home },
            { href: "/app/messages", label: "Meddelanden", icon: MessageCircle },
            { href: "/app/scan", label: "Skanna", icon: ScanLine },
            { href: "/app/courses", label: "Kurser", icon: BookOpen },
            { href: "/app/profile", label: "Profil", icon: User },
          ]
        : [
            { href: "/app", label: "Hem", icon: Home },
            { href: "/app/messages", label: "Meddelanden", icon: MessageCircle },
            { href: "/app/scan", label: "Skanna", icon: ScanLine },
            { href: "/app/events", label: "Evenemang", icon: Building2 },
            { href: "/app/profile", label: "Profil", icon: User },
          ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--usha-border)] bg-[var(--usha-black)]/95 backdrop-blur-lg md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 text-xs transition-colors ${
                isActive
                  ? "text-[var(--usha-gold)]"
                  : "text-[var(--usha-muted)] hover:text-white"
              }`}
            >
              <tab.icon size={22} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={isActive ? "font-semibold" : "font-normal"}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
