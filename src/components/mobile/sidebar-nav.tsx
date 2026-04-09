"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  Ticket,
  BookOpen,
  User,
  Building2,
  MessageCircle,
  ScanLine,
  FileText,
  BookMarked,
  Trophy,
} from "lucide-react";
import { useRole } from "./role-context";
import { useSubscription } from "@/lib/subscription/context";
import { LanguageSwitcher } from "@/components/language-switcher";

export function SidebarNav() {
  const pathname = usePathname();
  const { role } = useRole();
  const { tier } = useSubscription();
  const t = useTranslations("nav");

  const tabs =
    role === "publik"
      ? [
          { href: "/app", label: t("home"), icon: Home },
          { href: "/app/posts", label: t("myPosts"), icon: FileText },
          { href: "/app/library", label: t("library"), icon: BookMarked },
          { href: "/app/messages", label: t("messages"), icon: MessageCircle },
          { href: "/app/tickets", label: t("tickets"), icon: Ticket },
          { href: "/app/leaderboard", label: t("leaderboard"), icon: Trophy },
          { href: "/app/profile", label: t("profile"), icon: User },
        ]
      : role === "kreator"
        ? [
            { href: "/app", label: t("home"), icon: Home },
            { href: "/app/posts", label: t("myPosts"), icon: FileText },
            { href: "/app/messages", label: t("messages"), icon: MessageCircle },
            { href: "/app/tickets", label: t("tickets"), icon: Ticket },
            { href: "/app/scan", label: t("scan"), icon: ScanLine },
            { href: "/app/courses", label: t("content"), icon: BookOpen },
            { href: "/app/library", label: t("library"), icon: BookMarked },
            { href: "/app/leaderboard", label: t("leaderboard"), icon: Trophy },
            { href: "/app/profile", label: t("profile"), icon: User },
          ]
        : [
            { href: "/app", label: t("home"), icon: Home },
            { href: "/app/posts", label: t("myPosts"), icon: FileText },
            { href: "/app/messages", label: t("messages"), icon: MessageCircle },
            { href: "/app/tickets", label: t("tickets"), icon: Ticket },
            { href: "/app/scan", label: t("scan"), icon: ScanLine },
            { href: "/app/events", label: t("events"), icon: Building2 },
            { href: "/app/library", label: t("library"), icon: BookMarked },
            { href: "/app/leaderboard", label: t("leaderboard"), icon: Trophy },
            { href: "/app/profile", label: t("profile"), icon: User },
          ];

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 flex-shrink-0 sticky top-0 h-screen flex-col justify-between border-r border-[var(--usha-border)] bg-[var(--usha-black)]">
      <div>
        {/* Logo */}
        <a href="/app" className="flex items-center gap-2.5 px-6 py-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-sm font-bold text-black">U</span>
          </div>
          <span className="text-xl font-bold tracking-tight">Usha</span>
        </a>

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
      </div>

      {/* Language switcher at bottom */}
      <div className="px-4 pb-6">
        <LanguageSwitcher />
      </div>
    </aside>
  );
}
