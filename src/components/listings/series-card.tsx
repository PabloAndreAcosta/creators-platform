"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, Layers } from "lucide-react";

/**
 * Shared collapsible series card chrome (emblem + title + badge + meta + the
 * collapse toggle). Each surface supplies its own occurrence rendering via
 * `children` and any right-aligned controls via `headerActions`, so the look
 * stays per-surface while the grouping/collapse logic lives once.
 */
export function SeriesCard({
  title,
  badge,
  meta,
  headerActions,
  children,
  defaultOpen = false,
}: {
  title: string;
  badge: string;
  meta: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)]">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
            <Layers size={20} className="text-[var(--usha-gold)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate font-semibold">{title}</h3>
              <span className="shrink-0 rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--usha-gold)]">
                {badge}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3 text-xs text-[var(--usha-muted)] sm:text-sm">
              {meta}
            </div>
          </div>
          <ChevronDown size={18} className={`shrink-0 text-[var(--usha-muted)] transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {headerActions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{headerActions}</div>}
      </div>
      {open && <div className="border-t border-[var(--usha-border)]">{children}</div>}
    </div>
  );
}
