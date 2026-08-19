"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { ADMIN_DESTINATIONS, ADMIN_ROOT } from "@/lib/navigation/registry";

/**
 * The row of admin tools, shown on every admin page.
 *
 * Before this, each tool was a dead end: you reached it by typing the URL and
 * the only way out was a back-link to /dashboard. Moving between two admin
 * tools meant leaving the admin area entirely.
 */
export function AdminNav() {
  const pathname = usePathname();
  const t = useTranslations("adminPage");

  return (
    <nav className="mb-6 space-y-3">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
      >
        <ArrowLeft size={15} />
        {t("backToApp")}
      </Link>

      <div className="flex flex-wrap gap-2">
        <ToolLink href={ADMIN_ROOT} active={pathname === ADMIN_ROOT} label={t("heading")} />
        {ADMIN_DESTINATIONS.map((d) => (
          <ToolLink
            key={d.path}
            href={d.path}
            active={pathname.startsWith(d.path)}
            label={t(d.labelKey)}
          />
        ))}
      </div>
    </nav>
  );
}

function ToolLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "border-[var(--usha-gold)]/40 bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]"
          : "border-[var(--usha-border)] text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
      }`}
    >
      {label}
    </Link>
  );
}
