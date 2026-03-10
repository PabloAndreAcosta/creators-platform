'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Subscription {
  tier: 'guld' | 'premium';
  currentPeriodEnd: Date;
  status: string;
}

interface UpcomingMasterclass {
  title: string;
  instructor: string;
  date: Date;
}

interface GuldMemberDashboardProps {
  subscription: Subscription;
  discountsSavedThisMonth: number;
  upcomingMasterclass?: UpcomingMasterclass;
}

const BENEFITS = {
  guld: [
    '10% rabatt på bokningar',
    '48 timmar tidig tillgång',
    'Prioritetskö',
    'Månatlig masterclass',
  ],
  premium: [
    '20% rabatt på bokningar',
    'VIP — aldrig i kö',
    'Exklusivt innehåll',
    '72 timmar tidig tillgång',
    'Månatlig masterclass',
    'Dedicerad support',
  ],
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function GuldMemberDashboard({
  subscription,
  discountsSavedThisMonth,
  upcomingMasterclass,
}: GuldMemberDashboardProps) {
  const [earlyAccessHours, setEarlyAccessHours] = useState<number | null>(null);

  const isGuld = subscription.tier === 'guld';
  const isPremium = subscription.tier === 'premium';
  const tierLabel = isGuld ? 'Guld' : 'Premium';
  const benefits = BENEFITS[subscription.tier];

  // Calculate early access countdown (48h/72h window)
  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const window = isPremium ? 72 : 48;
      const hoursRemaining = Math.max(
        0,
        window - ((now.getTime() % (window * 60 * 60 * 1000)) / (60 * 60 * 1000))
      );
      setEarlyAccessHours(Math.round(hoursRemaining * 10) / 10);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 60 * 1000);
    return () => clearInterval(interval);
  }, [isPremium]);

  const earlyAccessWindow = isPremium ? 72 : 48;

  return (
    <div className="space-y-5">
      {/* Badge Section */}
      <div
        className={cn(
          'relative overflow-hidden rounded-2xl p-6',
          'border',
          isGuld
            ? 'border-[var(--usha-gold)]/30 bg-gradient-to-br from-[var(--usha-gold)]/10 to-[var(--usha-card)]'
            : 'border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-[var(--usha-card)]'
        )}
      >
        <div className="absolute top-0 right-0 w-32 h-32 opacity-10">
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
            <polygon
              points="50,5 63,35 95,40 72,62 78,95 50,78 22,95 28,62 5,40 37,35"
              fill={isGuld ? 'var(--usha-gold)' : '#a855f7'}
            />
          </svg>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div
            className={cn(
              'px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
              isGuld
                ? 'bg-[var(--usha-gold)]/20 text-[var(--usha-gold)]'
                : 'bg-purple-500/20 text-purple-400'
            )}
          >
            {tierLabel} Medlem
          </div>
          {subscription.status === 'active' && (
            <span className="text-xs text-green-500 font-medium">Aktiv</span>
          )}
        </div>

        <h2
          className={cn(
            'text-2xl font-bold mb-1',
            isGuld ? 'text-gradient' : 'text-purple-300'
          )}
        >
          {tierLabel} Medlem
        </h2>
        <p className="text-sm text-[var(--usha-muted)]">
          Giltig till {formatDate(subscription.currentPeriodEnd)}
        </p>
      </div>

      {/* Savings Card */}
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <p className="text-sm text-[var(--usha-muted)] mb-1">
          Totalt sparat denna månad
        </p>
        <p className="text-3xl font-bold text-[var(--usha-white)]">
          {discountsSavedThisMonth.toLocaleString('sv-SE')}{' '}
          <span className="text-lg text-[var(--usha-muted)]">SEK</span>
        </p>
      </div>

      {/* Early Access Countdown */}
      {earlyAccessHours !== null && earlyAccessHours < earlyAccessWindow && (
        <div
          className={cn(
            'rounded-2xl border p-5',
            isGuld
              ? 'border-[var(--usha-gold)]/20 bg-[var(--usha-gold)]/5'
              : 'border-purple-500/20 bg-purple-500/5'
          )}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--usha-white)]">
                Tidig tillgång aktiv
              </p>
              <p className="text-xs text-[var(--usha-muted)]">
                Boka innan alla andra
              </p>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  'text-2xl font-bold font-mono',
                  isGuld ? 'text-[var(--usha-gold)]' : 'text-purple-400'
                )}
              >
                {Math.floor(earlyAccessHours)}h{' '}
                {Math.round((earlyAccessHours % 1) * 60)}m
              </p>
              <p className="text-xs text-[var(--usha-muted)]">kvar</p>
            </div>
          </div>
        </div>
      )}

      {/* Benefits List */}
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--usha-white)] mb-3">
          Dina förmåner
        </h3>
        <ul className="space-y-2.5">
          {benefits.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5">
              <svg
                className={cn(
                  'w-4 h-4 mt-0.5 flex-shrink-0',
                  isGuld ? 'text-[var(--usha-gold)]' : 'text-purple-400'
                )}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-sm text-[var(--usha-muted)]">
                {benefit}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Upcoming Masterclass */}
      {upcomingMasterclass && (
        <div
          className={cn(
            'rounded-2xl border p-5',
            isGuld
              ? 'border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-card)] to-[var(--usha-gold)]/5'
              : 'border-purple-500/20 bg-gradient-to-br from-[var(--usha-card)] to-purple-500/5'
          )}
        >
          <p className="text-xs uppercase tracking-wider text-[var(--usha-muted)] mb-2">
            Kommande masterclass
          </p>
          <h3 className="text-lg font-semibold text-[var(--usha-white)] mb-1">
            {upcomingMasterclass.title}
          </h3>
          <p className="text-sm text-[var(--usha-muted)] mb-1">
            Med {upcomingMasterclass.instructor}
          </p>
          <p className="text-sm text-[var(--usha-muted)] mb-4">
            {formatDateTime(upcomingMasterclass.date)}
          </p>
          <Button
            className={cn(
              'w-full font-semibold',
              isGuld
                ? 'bg-[var(--usha-gold)] hover:bg-[var(--usha-gold-light)] text-black'
                : 'bg-purple-600 hover:bg-purple-500 text-white'
            )}
          >
            Gå med i masterclass
          </Button>
        </div>
      )}
    </div>
  );
}

/** Loading skeleton for GuldMemberDashboard */
export function GuldMemberDashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-36" />
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-24" />
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-64" />
    </div>
  );
}
