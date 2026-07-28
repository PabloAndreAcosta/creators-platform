"use client";

import { ReactNode, useState } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { RoleProvider } from "./role-context";
import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { RoleToggle } from "./role-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { SearchBar } from "@/components/search-bar";
import { LanguageSwitcher } from "@/components/language-switcher";
import UschjaLogo from "@/components/UschjaLogo";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppShellProps {
  children: ReactNode;
  userName: string;
}

export function AppShell({ children, userName }: AppShellProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const t = useTranslations("search");

  return (
    <RoleProvider>
      <div className="flex min-h-screen bg-[var(--usha-black)]">
        {/* Sidebar – desktop only */}
        <SidebarNav />

        {/* Main content area */}
        <div className="min-h-screen w-full md:flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/95 backdrop-blur-lg">
            <div className="flex items-center gap-2 px-4 py-3">
              {/* Logo – mobile only. shrink-0 (just the icon on phones). The
                  "Usha Platform" wordmark shows only from sm up, where there's
                  room: on a narrow phone the action controls need the width, so
                  hiding the wordmark keeps the header clean instead of
                  truncating it to "Us…". The dark logo tile carries the brand. */}
              <a
                href="/app"
                aria-label="Usha Platform – hem"
                className="flex shrink-0 items-center gap-2 transition-opacity duration-150 active:opacity-50 md:hidden"
              >
                <UschjaLogo size={32} />
                {!mobileSearchOpen && (
                  <span className="hidden text-lg font-bold tracking-tight sm:inline">Usha Platform</span>
                )}
              </a>

              {/* SearchBar – desktop: always visible */}
              <div className="hidden flex-1 md:block md:max-w-md">
                <SearchBar />
              </div>

              {/* SearchBar – mobile: toggled */}
              {mobileSearchOpen && (
                <div className="flex-1 md:hidden">
                  <SearchBar onSearch={() => setMobileSearchOpen(false)} />
                </div>
              )}

              {/* Actions — shrink-0 so the controls always stay fully on-screen
                  and the logo gives up space first. */}
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {/* Mobile search toggle */}
                <button
                  onClick={() => setMobileSearchOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card)] hover:text-[var(--usha-white)] md:hidden"
                  aria-label={mobileSearchOpen ? t("closeSearch") : t("openSearch")}
                >
                  {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
                </button>
                <ThemeToggle />
                <LanguageSwitcher className="hidden md:flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card)] hover:text-[var(--usha-white)]" />
                <NotificationBell />
                <RoleToggle />
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="pb-[calc(5rem+env(safe-area-inset-bottom,0px))] md:pb-8">{children}</main>

          {/* Bottom navigation – mobile only */}
          <BottomNav />
        </div>
      </div>
    </RoleProvider>
  );
}
