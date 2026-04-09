"use client";

import { Settings, Bell, Shield, HelpCircle, UserX, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

export default function SettingsPage() {
  const t = useTranslations("settings");

  const settingsItems = [
    {
      href: "/app/settings/notifications",
      label: t("notifications"),
      description: t("notificationsDesc"),
      icon: Bell,
    },
    {
      href: "/app/settings/privacy",
      label: t("privacy"),
      description: t("privacyDesc"),
      icon: Shield,
    },
    {
      href: "/app/settings/help",
      label: t("help"),
      description: t("helpDesc"),
      icon: HelpCircle,
    },
    {
      href: "/app/settings/account",
      label: t("account"),
      description: t("accountDesc"),
      icon: UserX,
    },
  ];

  return (
    <div className="px-4 py-6 space-y-6 md:max-w-2xl md:mx-auto">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">{t("title")}</h1>
      </div>

      <div className="space-y-2">
        {settingsItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-4 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/20"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--usha-border)]">
              <item.icon size={18} className="text-[var(--usha-muted)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="text-xs text-[var(--usha-muted)]">{item.description}</p>
            </div>
            <ChevronRight size={16} className="text-[var(--usha-muted)]" />
          </Link>
        ))}
      </div>
    </div>
  );
}
