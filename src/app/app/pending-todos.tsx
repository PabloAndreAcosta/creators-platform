"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Inbox, Clock } from "lucide-react";
import type { TodoItem, TodoKey } from "@/lib/todo/pending";

const ICONS: Record<TodoKey, typeof Inbox> = {
  venueRequests: Inbox,
  awaitingVenue: Clock,
};

/**
 * Vad som väntar, överst på startsidan.
 *
 * Ligger ovanför kom-igång-checklistan med flit: checklistan är sådant du
 * ställer in en gång, det här är sådant någon annan skickat och som inte
 * händer förrän du svarar. Panelen försvinner helt när kön är tom — en ruta
 * som säger "inget att göra" är bara brus att scrolla förbi.
 */
export function PendingTodos({ items }: { items: TodoItem[] }) {
  const t = useTranslations("pendingTodos");
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="pending-todos-heading"
      className="rounded-2xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-4 sm:p-5"
    >
      <h2
        id="pending-todos-heading"
        className="mb-3 text-sm font-semibold text-[var(--usha-gold)]"
      >
        {t("heading")}
      </h2>

      <ul className="space-y-2">
        {items.map((item) => {
          const Icon = ICONS[item.key];
          return (
            <li key={item.key}>
              <Link
                href={item.href}
                className="flex items-center gap-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-4 py-3 transition hover:border-[var(--usha-gold)]/50"
              >
                <Icon size={18} className="shrink-0 text-[var(--usha-gold)]" />
                <span className="flex-1 text-sm font-medium">
                  {t(`${item.key}.text`, { count: item.count })}
                </span>
                <span className="shrink-0 text-xs font-medium text-[var(--usha-muted)]">
                  {t(`${item.key}.action`)}
                </span>
                <ArrowRight size={15} className="shrink-0 text-[var(--usha-muted)]" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
