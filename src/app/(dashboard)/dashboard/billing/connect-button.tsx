'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { isConnectComplete } from '@/lib/stripe/connect-status';

interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted?: boolean;
  /** card_payments capability — what lets the organizer be merchant of record. */
  cardPaymentsEnabled?: boolean;
}

export default function ConnectButton() {
  const t = useTranslations('billingConnect');
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/stripe/connect/status');
        const data = await res.json();
        setStatus(data);
      } catch {
        setStatus({ connected: false, chargesEnabled: false, payoutsEnabled: false });
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  async function handleConnect() {
    setConnecting(true);
    setError("");
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || t('errorCouldNotStart'));
        setConnecting(false);
      }
    } catch {
      setError(t('errorNetwork'));
      setConnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 animate-pulse">
        <div className="h-5 w-40 bg-[var(--usha-border)] rounded mb-3" />
        <div className="h-4 w-64 bg-[var(--usha-border)] rounded" />
      </div>
    );
  }

  // "Done" has to mean the same thing here as in the onboarding checklist.
  //
  // This used to stop at payouts_enabled, so an account that could receive money
  // but had never been granted the card_payments capability showed "All set" —
  // and, because the whole guide is hidden when fully connected, the button that
  // requests that very capability disappeared with it. The checklist meanwhile
  // kept asking for a step whose only control was no longer on the page.
  const isFullyConnected = isConnectComplete(status);

  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">{t('title')}</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            {isFullyConnected
              ? t('descriptionConnected')
              : status?.connected && !status?.payoutsEnabled
                ? t('descriptionIncomplete')
                : t('descriptionNotConnected')}
          </p>
        </div>
        <div className="flex-shrink-0">
          {isFullyConnected ? (
            <div className="flex items-center gap-1.5 text-green-400">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">{t('statusConnected')}</span>
            </div>
          ) : status?.connected ? (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">{t('statusIncomplete')}</span>
            </div>
          ) : null}
        </div>
      </div>

      {!isFullyConnected && (
        <>
          {/* Step-by-step guide */}
          <div className="mt-4 space-y-2">
            {[
              { step: 1, label: t('stepCreateAccount'), done: !!status?.connected },
              { step: 2, label: t('stepVerifyIdentity'), done: !!status?.detailsSubmitted },
              { step: 3, label: t('stepEnablePayouts'), done: !!status?.payoutsEnabled },
              { step: 4, label: t('stepEnableCardPayments'), done: !!status?.cardPaymentsEnabled },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-3">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  s.done
                    ? 'bg-green-500/10 text-green-400'
                    : 'bg-[var(--usha-border)] text-[var(--usha-muted)]'
                }`}>
                  {s.done ? <CheckCircle size={14} /> : s.step}
                </div>
                <span className={`text-xs ${s.done ? 'text-green-400' : 'text-[var(--usha-muted)]'}`}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {error && (
            <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
          >
            {connecting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                {t('connecting')}
              </>
            ) : (
              <>
                <ExternalLink size={14} />
                {status?.connected ? t('completeConnection') : t('connectBankAccount')}
              </>
            )}
          </button>

          <p className="mt-2 text-[10px] text-[var(--usha-muted)]">
            {t('helperRedirect')}
            <br />
            {t('helperFree')}
          </p>
        </>
      )}

      {isFullyConnected && (
        <div className="mt-4 rounded-lg bg-green-500/5 border border-green-500/20 p-3">
          <p className="text-xs text-green-400">
            {t('allSet')}
          </p>
        </div>
      )}
    </div>
  );
}
