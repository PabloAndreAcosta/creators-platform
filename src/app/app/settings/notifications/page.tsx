"use client";

import { useState } from "react";
import { ArrowLeft, Bell } from "lucide-react";
import Link from "next/link";

interface NotifSetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const defaultSettings: NotifSetting[] = [
  { id: "booking_new", label: "Nya bokningar", description: "Få notis när någon bokar en av dina tjänster", enabled: true },
  { id: "booking_confirmed", label: "Bekräftade bokningar", description: "Få notis när en bokning bekräftas", enabled: true },
  { id: "booking_canceled", label: "Avbokningar", description: "Få notis vid avbokningar", enabled: true },
  { id: "payout", label: "Utbetalningar", description: "Få notis när en utbetalning genomförs", enabled: true },
  { id: "marketing", label: "Tips och nyheter", description: "Få nyhetsbrev och plattformstips", enabled: false },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState(defaultSettings);

  function toggleSetting(id: string) {
    setSettings((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  }

  return (
    <div className="px-4 py-6 space-y-6 md:max-w-2xl md:mx-auto">
      <div>
        <Link
          href="/app/profile"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-[var(--usha-gold)]" />
          <h1 className="text-2xl font-bold">Notifikationer</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          Välj vilka e-postnotiser du vill få.
        </p>
      </div>

      <div className="space-y-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
        {settings.map((setting) => (
          <label
            key={setting.id}
            className="flex items-center gap-4 px-4 py-4 cursor-pointer transition-colors hover:bg-[var(--usha-card-hover)]"
          >
            <div className="flex-1">
              <p className="text-sm font-medium">{setting.label}</p>
              <p className="text-xs text-[var(--usha-muted)]">{setting.description}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={setting.enabled}
              onClick={() => toggleSetting(setting.id)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                setting.enabled ? "bg-[var(--usha-gold)]" : "bg-[var(--usha-border)]"
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  setting.enabled ? "translate-x-5" : "translate-x-0.5"
                } mt-0.5`}
              />
            </button>
          </label>
        ))}
      </div>

      <p className="text-xs text-[var(--usha-muted)] text-center">
        Inställningarna sparas automatiskt.
      </p>
    </div>
  );
}
