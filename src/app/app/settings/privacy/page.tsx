"use client";

import { useState } from "react";
import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

interface PrivacySetting {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

const defaultSettings: PrivacySetting[] = [
  { id: "public_profile", label: "Publik profil", description: "Visa din profil i marketplace så att kunder kan hitta dig", enabled: true },
  { id: "show_location", label: "Visa plats", description: "Visa din plats på din profil", enabled: true },
  { id: "show_reviews", label: "Visa recensioner", description: "Tillåt att dina recensioner visas publikt", enabled: true },
  { id: "booking_history", label: "Bokningshistorik", description: "Tillåt kreatörer att se din bokningshistorik", enabled: false },
];

export default function PrivacyPage() {
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
          <Shield size={20} className="text-[var(--usha-gold)]" />
          <h1 className="text-2xl font-bold">Integritetsinställningar</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          Styr vilken information som är synlig för andra.
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

      <div className="space-y-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
        <h3 className="text-sm font-semibold">Juridisk information</h3>
        <div className="flex flex-wrap gap-3 text-xs text-[var(--usha-muted)]">
          <Link href="/privacy" className="underline hover:text-white">Integritetspolicy</Link>
          <Link href="/terms" className="underline hover:text-white">Användarvillkor</Link>
          <Link href="/cookies" className="underline hover:text-white">Cookiepolicy</Link>
        </div>
      </div>
    </div>
  );
}
