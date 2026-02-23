'use client';

import { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface ConnectStatus {
  connected: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted?: boolean;
}

export default function ConnectButton() {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

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
    try {
      const res = await fetch('/api/stripe/connect', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('No onboarding URL returned');
        setConnecting(false);
      }
    } catch {
      console.error('Failed to start connect onboarding');
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

  const isFullyConnected = status?.connected && status?.payoutsEnabled;

  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Bankkonto</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            {isFullyConnected
              ? 'Ditt bankkonto är anslutet och redo för utbetalningar.'
              : status?.connected && !status?.payoutsEnabled
                ? 'Ditt Stripe-konto behöver fler uppgifter innan utbetalningar kan göras.'
                : 'Anslut ditt bankkonto via Stripe för att ta emot utbetalningar.'}
          </p>
        </div>
        <div className="flex-shrink-0">
          {isFullyConnected ? (
            <div className="flex items-center gap-1.5 text-green-400">
              <CheckCircle size={16} />
              <span className="text-sm font-medium">Ansluten</span>
            </div>
          ) : status?.connected ? (
            <div className="flex items-center gap-1.5 text-yellow-400">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">Ofullständig</span>
            </div>
          ) : null}
        </div>
      </div>

      {!isFullyConnected && (
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90 disabled:opacity-50"
        >
          {connecting ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Ansluter...
            </>
          ) : (
            <>
              <ExternalLink size={14} />
              {status?.connected ? 'Slutför anslutning' : 'Anslut bankkonto'}
            </>
          )}
        </button>
      )}
    </div>
  );
}
