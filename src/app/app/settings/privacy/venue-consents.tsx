"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface Item {
  venueProfileId: string;
  venueName: string;
  granted: boolean;
}

/**
 * Lokaler man sagt ja till att höra från, och vägen att ångra sig.
 *
 * Döljs helt när listan är tom, vilket den är för de allra flesta. En rubrik
 * över ingenting förklarar bara något som inte händer.
 */
export default function VenueConsents() {
  const t = useTranslations("privacySettings.venueConsents");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/venue-consent")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(item: Item) {
    setSaving(item.venueProfileId);
    try {
      const res = await fetch("/api/venue-consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venueProfileId: item.venueProfileId, granted: !item.granted }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((i) =>
            i.venueProfileId === item.venueProfileId ? { ...i, granted: !i.granted } : i
          )
        );
      }
    } finally {
      setSaving(null);
    }
  }

  if (loading || items.length === 0) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
      <div>
        <h3 className="text-sm font-semibold">{t("heading")}</h3>
        <p className="mt-1 text-xs text-[var(--usha-muted)]">{t("intro")}</p>
      </div>

      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i.venueProfileId} className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm">{i.venueName}</p>
              <p className="text-xs text-[var(--usha-muted)]">
                {i.granted ? t("on") : t("off")}
              </p>
            </div>
            <button
              onClick={() => toggle(i)}
              disabled={saving === i.venueProfileId}
              className="shrink-0 rounded-full border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--usha-gold)]/40 disabled:opacity-50"
            >
              {saving === i.venueProfileId ? (
                <Loader2 size={13} className="animate-spin" />
              ) : i.granted ? (
                t("stop")
              ) : (
                t("resume")
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
