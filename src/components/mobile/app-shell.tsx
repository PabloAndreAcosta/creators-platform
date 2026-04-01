"use client";

import { ReactNode, useState } from "react";
import { Search, X } from "lucide-react";
import { RoleProvider } from "./role-context";
import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { RoleToggle } from "./role-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { SearchBar } from "@/components/search-bar";

interface AppShellProps {
  children: ReactNode;
  userName: string;
}

export function AppShell({ children, userName }: AppShellProps) {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  return (
    <RoleProvider>
      <div className="flex min-h-screen bg-[var(--usha-black)]">
        {/* Sidebar – desktop only */}
        <SidebarNav />

        {/* Main content area */}
        <div className="mx-auto min-h-screen w-full max-w-lg md:mx-0 md:max-w-none md:flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-40 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/95 backdrop-blur-lg">
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Logo – mobile only */}
              <a href="/app" className="flex items-center gap-2 md:hidden">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                  <span className="text-sm font-bold text-black">U</span>
                </div>
                {!mobileSearchOpen && (
                  <span className="text-lg font-bold tracking-tight">Usha</span>
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

              {/* Actions */}
              <div className="ml-auto flex items-center gap-2">
                {/* Mobile search toggle */}
                <button
                  onClick={() => setMobileSearchOpen((v) => !v)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--usha-muted)] transition-colors hover:bg-[var(--usha-card)] hover:text-white md:hidden"
                  aria-label={mobileSearchOpen ? "Stäng sök" : "Öppna sök"}
                >
                  {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
                </button>
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
