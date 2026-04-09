"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Bell, Loader2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface NotifSetting {
  id: string;
  dbKey: string;
  label: string;
  description: string;
}

export default function NotificationsPage() {
  const t = useTranslations("notifSettings");
  const tc = useTranslations("common");
  const ts = useTranslations("settings");

  const NOTIF_SETTINGS: NotifSetting[] = [
    { id: "booking_new", dbKey: "notif_booking_new", label: t("newBookings"), description: t("newBookingsDesc") },
    { id: "booking_confirmed", dbKey: "notif_booking_confirmed", label: t("confirmedBookings"), description: t("confirmedBookingsDesc") },
    { id: "booking_canceled", dbKey: "notif_booking_canceled", label: t("cancellations"), description: t("cancellationsDesc") },
    { id: "payout", dbKey: "notif_payout", label: t("payouts"), description: t("payoutsDesc") },
    { id: "marketing", dbKey: "notif_marketing", label: t("marketing"), description: t("marketingDesc") },
  ];

  const [values, setValues] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => {
        const s = data.settings ?? {};
        const v: Record<string, boolean> = {};
        for (const ns of NOTIF_SETTINGS) {
          v[ns.dbKey] = s[ns.dbKey] ?? (ns.id !== "marketing");
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
      // Revert on error
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
          {tc("back")}
        </Link>
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-[var(--usha-gold)]" />
          <h1 className="text-2xl font-bold">{ts("notifications")}</h1>
        </div>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">
          {ts("chooseNotifications")}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--usha-muted)]" />
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
          {NOTIF_SETTINGS.map((setting) => (
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

      <p className="text-xs text-[var(--usha-muted)] text-center">
        {ts("autoSave")}
      </p>
    </div>
  );
}
