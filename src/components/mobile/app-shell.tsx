"use client";

import { ReactNode } from "react";
import { RoleProvider } from "./role-context";
import { BottomNav } from "./bottom-nav";
import { RoleToggle } from "./role-toggle";

interface AppShellProps {
  children: ReactNode;
  userName: string;
}

export function AppShell({ children, userName }: AppShellProps) {
  return (
    <RoleProvider>
      <div className="mx-auto min-h-screen max-w-lg bg-[var(--usha-black)]">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--usha-border)] bg-[var(--usha-black)]/95 px-4 py-3 backdrop-blur-lg">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
              <span className="text-sm font-bold text-black">U</span>
            </div>
            <span className="text-lg font-bold tracking-tight">Usha</span>
          </div>
          <RoleToggle />
        </header>

        {/* Content */}
        <main className="pb-24">{children}</main>

        {/* Bottom navigation */}
        <BottomNav />
      </div>
    </RoleProvider>
  );
}
