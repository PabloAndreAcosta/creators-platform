'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

interface InstantPayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorId: string;
  availableAmount: number;
  payoutsThisMonth: number;
}

function sek(amount: number): string {
  return amount.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function InstantPayoutModal({
  isOpen,
  onClose,
  creatorId,
  availableAmount,
  payoutsThisMonth,
}: InstantPayoutModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFee = payoutsThisMonth >= 1;
  const fee = hasFee ? Math.round(availableAmount * 0.01) : 0;
  const netAmount = availableAmount - fee;
  const ordinal = payoutsThisMonth === 0 ? '1:a' : `${payoutsThisMonth + 1}:a`;

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/payouts/instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, amount: availableAmount }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error ?? 'Något gick fel. Försök igen.');
        return;
      }

      setSuccess(true);
    } catch {
      setError('Nätverksfel. Kontrollera din anslutning.');
    } finally {
      setLoading(false);
    }
  }

  function handleClose() {
    setSuccess(false);
    setError(null);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md bg-[var(--usha-card)] border border-[var(--usha-border)] rounded-t-2xl sm:rounded-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-[var(--usha-white)]">
            Snabbutbetalning
          </h3>
          <button
            onClick={handleClose}
            className="text-[var(--usha-muted)] hover:text-[var(--usha-white)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          /* Success State */
          <div className="text-center py-4 space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-[var(--usha-white)]">
              Uttaget är på väg!
            </h4>
            <p className="text-sm text-[var(--usha-muted)]">
              Pengarna kommer inom 5–10 minuter
            </p>
            <p className="text-2xl font-bold text-[var(--usha-gold)]">
              {sek(netAmount)} SEK
            </p>
            <Button
              onClick={handleClose}
              className="w-full mt-2 bg-[var(--usha-border)] hover:bg-[var(--usha-card-hover)] text-[var(--usha-white)]"
            >
              Stäng
            </Button>
          </div>
        ) : (
          /* Payout Form */
          <div className="space-y-4">
            {/* Breakdown */}
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--usha-muted)]">Tillgängligt belopp</span>
                <span className="text-[var(--usha-white)]">{sek(availableAmount)} SEK</span>
              </div>
              {hasFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--usha-muted)]">Avgift (1%)</span>
                  <span className="text-red-400">-{sek(fee)} SEK</span>
                </div>
              )}
              <div className="h-px bg-[var(--usha-border)]" />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-[var(--usha-white)]">Du får</span>
                <span className="text-2xl font-bold text-[var(--usha-gold)]">
                  {sek(netAmount)} SEK
                </span>
              </div>
            </div>

            {/* Info */}
            <div className="rounded-xl bg-[var(--usha-black)]/50 p-3 space-y-1">
              <p className="text-xs text-[var(--usha-muted)]">
                Detta är din {ordinal} snabbutbetalning denna månad
              </p>
              {hasFee ? (
                <p className="text-xs text-[var(--usha-accent)]">
                  Ytterligare instant payouts kostar 1%
                </p>
              ) : (
                <p className="text-xs text-green-400">
                  Första instant payout varje månad är gratis
                </p>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <Button
                onClick={handleConfirm}
                disabled={loading || netAmount <= 0}
                className="w-full bg-[var(--usha-gold)] hover:bg-[var(--usha-gold-light)] text-black font-semibold"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Bearbetar...
                  </span>
                ) : (
                  'Bekräfta uttag'
                )}
              </Button>
              <Button
                onClick={handleClose}
                variant="ghost"
                className="w-full text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
              >
                Avbryt
              </Button>
            </div>

            <p className="text-xs text-center text-[var(--usha-muted)]">
              Pengarna kommer inom 5–10 minuter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
