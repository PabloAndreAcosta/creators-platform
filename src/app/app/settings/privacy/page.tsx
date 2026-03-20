"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Shield, Loader2 } from "lucide-react";
import Link from "next/link";

interface PrivacySetting {
  id: string;
  dbKey: string;
  label: string;
  description: string;
}

const PRIVACY_SETTINGS: PrivacySetting[] = [
  { id: "public_profile", dbKey: "privacy_public_profile", label: "Publik profil", description: "Visa din profil i marketplace så att kunder kan hitta dig" },
  { id: "show_location", dbKey: "privacy_show_location", label: "Visa plats", description: "Visa din plats på din profil" },
  { id: "show_reviews", dbKey: "privacy_show_reviews", label: "Visa recensioner", description: "Tillåt att dina recensioner visas publikt" },
  { id: "booking_history", dbKey: "privacy_booking_history", label: "Bokningshistorik", description: "Tillåt kreatörer att se din bokningshistorik" },
];

export default function PrivacyPage() {
  const [values, setValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings ?? {};
        const v: Record<string, boolean> = {};
        for (const ps of PRIVACY_SETTINGS) {
          v[ps.dbKey] = s[ps.dbKey] ?? (ps.id !== "booking_history");
        }
        setValues(v);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleSetting = useCallback(async (dbKey: string) => {
    const newVal = !values[dbKey];
    setValues((prev) => ({ ...prev, [dbKey]: newVal }));
    setSaving(dbKey);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [dbKey]: newVal }),
      });
      if (!res.ok) {
        setValues((prev) => ({ ...prev, [dbKey]: !newVal }));
      }
    } catch {
      setValues((prev) => ({ ...prev, [dbKey]: !newVal }));
    } finally {
      setSaving(null);
    }
  }, [values]);

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

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--usha-muted)]" />
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
          {PRIVACY_SETTINGS.map((setting) => (
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
                aria-checked={values[setting.dbKey] ?? false}
                onClick={() => toggleSetting(setting.dbKey)}
                disabled={saving === setting.dbKey}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
                  values[setting.dbKey] ? "bg-[var(--usha-gold)]" : "bg-[var(--usha-border)]"
                } ${saving === setting.dbKey ? "opacity-50" : ""}`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                    values[setting.dbKey] ? "translate-x-5" : "translate-x-0.5"
                  } mt-0.5`}
                />
              </button>
            </label>
          ))}
        </div>
      )}

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
