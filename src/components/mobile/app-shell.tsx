"use client";

import { ReactNode } from "react";
import { RoleProvider } from "./role-context";
import { BottomNav } from "./bottom-nav";
import { SidebarNav } from "./sidebar-nav";
import { RoleToggle } from "./role-toggle";

interface AppShellProps {
  children: ReactNode;
  userName: string;
}

export function AppShell({ children, userName }: AppShellProps) {
  return (
    <RoleProvider>
      <div className="flex min-h-screen bg-[var(--usha-black)]">
        {/* Sidebar – desktop only */}
        <SidebarNav />

        {/* Main content area */}
        <div className="mx-auto min-h-screen w-full max-w-lg md:mx-0 md:max-w-none md:flex-1">
          {/* Top bar */}
          <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--usha-border)] bg-[var(--usha-black)]/95 px-4 py-3 backdrop-blur-lg">
            <div className="flex items-center gap-2 md:hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                <span className="text-sm font-bold text-black">U</span>
              </div>
              <span className="text-lg font-bold tracking-tight">Usha</span>
            </div>
            <div className="hidden md:block" />
            <RoleToggle />
          </header>

          {/* Content */}
          <main className="pb-24 md:pb-8">{children}</main>

          {/* Bottom navigation – mobile only */}
          <BottomNav />
        </div>
      </div>
    </RoleProvider>
  );
}
