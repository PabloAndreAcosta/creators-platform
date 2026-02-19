'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CreatorTierInfoProps {
  creatorTier: 'silver' | 'gold' | 'platinum';
  creatorEarningsThisMonth: number;
}

const TIER_CONFIG = {
  silver: {
    label: 'Silver',
    rate: 0.20,
    badgeStyle: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
    cardBorder: 'border-[var(--usha-border)]',
    accentColor: 'text-zinc-400',
    nextTier: 'gold' as const,
    nextLabel: 'Gold',
    message: 'Uppgradera till Gold och spara på provision',
  },
  gold: {
    label: 'Gold',
    rate: 0.10,
    badgeStyle: 'bg-[var(--usha-gold)]/15 text-[var(--usha-gold)] border-[var(--usha-gold)]/20',
    cardBorder: 'border-[var(--usha-gold)]/20',
    accentColor: 'text-[var(--usha-gold)]',
    nextTier: 'platinum' as const,
    nextLabel: 'Platinum',
    message: 'Uppgradera till Platinum för bästa villkoren',
  },
  platinum: {
    label: 'Platinum',
    rate: 0.05,
    badgeStyle: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
    cardBorder: 'border-purple-500/20',
    accentColor: 'text-purple-400',
    nextTier: null,
    nextLabel: null,
    message: 'Du har bästa möjliga provisionsgrad',
  },
};

function sek(amount: number): string {
  return Math.round(amount).toLocaleString('sv-SE');
}

export default function CreatorTierInfo({
  creatorTier,
  creatorEarningsThisMonth,
}: CreatorTierInfoProps) {
  const config = TIER_CONFIG[creatorTier];
  const commission = Math.round(creatorEarningsThisMonth * config.rate);
  const net = creatorEarningsThisMonth - commission;

  // Calculate savings comparison
  const goldSavings =
    creatorTier === 'silver'
      ? Math.round(creatorEarningsThisMonth * (0.20 - 0.10))
      : 0;
  const platinumSavings =
    creatorTier !== 'platinum'
      ? Math.round(creatorEarningsThisMonth * (config.rate - 0.05))
      : 0;

  return (
    <div className="space-y-5">
      {/* Tier Badge Card */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl p-5 border bg-[var(--usha-card)]',
          config.cardBorder
        )}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border',
                config.badgeStyle
              )}
            >
              {config.label}
            </div>
            <span className={cn('text-sm font-semibold', config.accentColor)}>
              {Math.round(config.rate * 100)}% provision
            </span>
          </div>
        </div>

        <p className="text-sm text-[var(--usha-muted)]">{config.message}</p>
      </div>

      {/* Earnings Breakdown */}
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--usha-white)] mb-3">
          Intäkter denna månad
        </h3>
        <div className="space-y-2.5">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--usha-muted)]">Totalt intjänat</span>
            <span className="text-[var(--usha-white)]">
              {sek(creatorEarningsThisMonth)} SEK
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--usha-muted)]">
              Provision ({Math.round(config.rate * 100)}%)
            </span>
            <span className="text-red-400">-{sek(commission)} SEK</span>
          </div>
          <div className="h-px bg-[var(--usha-border)]" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-[var(--usha-white)]">
              Du behåller
            </span>
            <span className={cn('text-xl font-bold', config.accentColor)}>
              {sek(net)} SEK
            </span>
          </div>
        </div>
      </div>

      {/* Savings Comparison */}
      {config.nextTier && creatorEarningsThisMonth > 0 && (
        <div
          className={cn(
            'rounded-2xl border p-5',
            config.nextTier === 'gold'
              ? 'border-[var(--usha-gold)]/20 bg-[var(--usha-gold)]/5'
              : 'border-purple-500/20 bg-purple-500/5'
          )}
        >
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                config.nextTier === 'gold'
                  ? 'bg-[var(--usha-gold)]/15'
                  : 'bg-purple-500/15'
              )}
            >
              <svg
                className={cn(
                  'w-4 h-4',
                  config.nextTier === 'gold'
                    ? 'text-[var(--usha-gold)]'
                    : 'text-purple-400'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--usha-white)]">
                Med {config.nextLabel} hade du sparat{' '}
                <span
                  className={
                    config.nextTier === 'gold'
                      ? 'text-[var(--usha-gold)]'
                      : 'text-purple-400'
                  }
                >
                  {sek(config.nextTier === 'gold' ? goldSavings : platinumSavings)} SEK
                </span>{' '}
                denna månad
              </p>
              <p className="text-xs text-[var(--usha-muted)] mt-0.5">
                {config.nextTier === 'gold'
                  ? 'Gold-kreatörer betalar bara 10% provision'
                  : 'Platinum-kreatörer betalar bara 5% provision'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tier Comparison */}
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--usha-white)] mb-3">
          Jämför nivåer
        </h3>
        <div className="space-y-2">
          {(['silver', 'gold', 'platinum'] as const).map((tier) => {
            const t = TIER_CONFIG[tier];
            const isActive = tier === creatorTier;
            const tierNet = Math.round(
              creatorEarningsThisMonth * (1 - t.rate)
            );
            return (
              <div
                key={tier}
                className={cn(
                  'flex items-center justify-between p-3 rounded-xl transition-colors',
                  isActive
                    ? 'bg-[var(--usha-black)]/50 border border-[var(--usha-border)]'
                    : 'opacity-60'
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-xs font-bold uppercase w-16',
                      tier === 'silver' && 'text-zinc-400',
                      tier === 'gold' && 'text-[var(--usha-gold)]',
                      tier === 'platinum' && 'text-purple-400'
                    )}
                  >
                    {t.label}
                  </span>
                  <span className="text-xs text-[var(--usha-muted)]">
                    {Math.round(t.rate * 100)}%
                  </span>
                  {isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 font-medium">
                      Nuvarande
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'text-sm font-semibold',
                    isActive
                      ? 'text-[var(--usha-white)]'
                      : 'text-[var(--usha-muted)]'
                  )}
                >
                  {sek(tierNet)} SEK
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade Button */}
      {config.nextTier && (
        <Button
          onClick={() => {
            window.location.href = '/dashboard/billing';
          }}
          className={cn(
            'w-full font-semibold text-base h-12',
            config.nextTier === 'gold'
              ? 'bg-[var(--usha-gold)] hover:bg-[var(--usha-gold-light)] text-black'
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          )}
        >
          Uppgradera till {config.nextLabel}
        </Button>
      )}
    </div>
  );
}
