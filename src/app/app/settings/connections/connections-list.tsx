"use client";

import { useState } from "react";
import { Instagram, Facebook, Music, AlertTriangle, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toaster";
import type { ConnectionState } from "@/lib/social/connection-state";

export type Provider = "instagram" | "facebook" | "tiktok";

export interface ConnectionView extends ConnectionState {
  provider: Provider;
  name: string;
  /** @användarnamn eller sidnamn — null när kopplingen aldrig gjorts. */
  accountLabel: string | null;
  /** Vad kopplingen används till, så valet blir begripligt. */
  purpose: string;
}

const ICONS = {
  instagram: Instagram,
  facebook: Facebook,
  tiktok: Music,
} as const;

export function ConnectionsList({ connections }: { connections: ConnectionView[] }) {
  const t = useTranslations("connections");
  const { toast } = useToast();
  const [busy, setBusy] = useState<Provider | null>(null);
  const [states, setStates] = useState(connections);

  async function handleDisconnect(provider: Provider) {
    setBusy(provider);
    try {
      const res = await fetch(`/api/${provider}/disconnect`, { method: "POST" });
      if (res.ok || res.redirected) {
        setStates((prev) =>
          prev.map((c) =>
            c.provider === provider
              ? { ...c, status: "disconnected", accountLabel: null, daysLeft: null, needsAction: false }
              : c
          )
        );
        toast.success(t("disconnectedToast"));
      } else {
        toast.error(t("disconnectFailed"));
      }
    } catch {
      toast.error(t("disconnectFailed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {states.map((c) => {
        const Icon = ICONS[c.provider];
        const isConnected = c.status !== "disconnected";

        return (
          <section
            key={c.provider}
            className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 space-y-4"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-border)]">
                <Icon size={18} className="text-[var(--usha-muted)]" />
              </div>

              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">{c.name}</h2>
                  <StatusBadge state={c} />
                </div>
                {c.accountLabel && (
                  <p className="truncate text-xs text-[var(--usha-muted)]">{c.accountLabel}</p>
                )}
                <p className="text-xs text-[var(--usha-muted)]">{c.purpose}</p>
              </div>
            </div>

            {c.needsAction && (
              <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                <AlertTriangle size={14} className="mt-px shrink-0" />
                <span>
                  {c.status === "expired"
                    ? t("expiredHint")
                    : t("expiringHint", { days: c.daysLeft ?? 0 })}
                </span>
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {/* Omkoppling är samma OAuth-väg som förstagångskoppling — svaret
                  skriver över raden. Ingen behöver koppla från först. */}
              <a
                href={`/api/${c.provider}/connect`}
                className={
                  c.needsAction || !isConnected
                    ? "inline-flex items-center gap-2 rounded-xl bg-[var(--usha-gold)] px-4 py-2 text-sm font-medium text-black transition hover:opacity-90"
                    : "inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-4 py-2 text-sm transition hover:bg-[var(--usha-border)]"
                }
              >
                <Icon size={14} />
                {isConnected ? t("reconnect") : t("connect")}
              </a>

              {isConnected && (
                <button
                  onClick={() => handleDisconnect(c.provider)}
                  disabled={busy === c.provider}
                  className="text-xs text-[var(--usha-muted)] transition hover:text-red-400 disabled:opacity-50"
                >
                  {busy === c.provider ? t("disconnecting") : t("disconnect")}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatusBadge({ state }: { state: ConnectionView }) {
  const t = useTranslations("connections");

  if (state.status === "disconnected") {
    return (
      <span className="rounded-full bg-[var(--usha-border)] px-2 py-0.5 text-[10px] font-bold text-[var(--usha-muted)]">
        {t("statusDisconnected")}
      </span>
    );
  }

  if (state.status === "expired") {
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-400">
        {t("statusExpired")}
      </span>
    );
  }

  if (state.status === "expiring_soon") {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
        {t("statusExpiringSoon")}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">
      <Check size={10} />
      {t("statusConnected")}
    </span>
  );
}
