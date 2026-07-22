"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  User,
  MessageCircle,
  Ticket,
  Building2,
  LayoutGrid,
} from "lucide-react";
import { useRole } from "./role-context";
import { useSubscription } from "@/lib/subscription/context";

export function BottomNav() {
  const pathname = usePathname();
  const { role } = useRole();
  const { tier } = useSubscription();
  const t = useTranslations("nav");

  const tabs =
    role === "customer"
      ? [
          { href: "/app", label: t("home"), icon: Home },
          { href: "/app/tickets", label: t("tickets"), icon: Ticket },
          { href: "/app/messages", label: t("messages"), icon: MessageCircle },
          { href: "/app/tools", label: t("more"), icon: LayoutGrid },
          { href: "/app/profile", label: t("profile"), icon: User },
        ]
      : [
          { href: "/app", label: t("home"), icon: Home },
          { href: "/app/tickets", label: t("tickets"), icon: Ticket },
          { href: "/app/events", label: t("events"), icon: Building2 },
          { href: "/app/tools", label: t("more"), icon: LayoutGrid },
          { href: "/app/profile", label: t("profile"), icon: User },
        ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--usha-border)] bg-[var(--usha-black)]/95 backdrop-blur-lg md:hidden">
      <div className="flex items-center px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/app"
              ? pathname === "/app"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 min-w-0 flex-col items-center gap-0.5 px-0.5 py-1.5 transition-colors ${
                isActive
                  ? "text-[var(--usha-gold)]"
                  : "text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
              }`}
            >
              <tab.icon size={20} strokeWidth={isActive ? 2.5 : 1.5} />
              <span className={`max-w-full truncate text-[10px] leading-tight ${isActive ? "font-semibold" : "font-normal"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
