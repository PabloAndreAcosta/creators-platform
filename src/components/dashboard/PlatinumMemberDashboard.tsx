'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

interface PlatinumSubscription {
  tier: 'platinum';
  currentPeriodEnd: Date;
}

interface UpcomingMasterclass {
  title: string;
  instructor: string;
  date: Date;
}

interface PlatinumMemberDashboardProps {
  subscription: PlatinumSubscription;
  discountsSavedThisMonth: number;
  upcomingMasterclass?: UpcomingMasterclass;
}

const PLATINUM_BENEFITS = [
  '30% rabatt på Tier A event (max 500 SEK)',
  '20% rabatt på Tier B event',
  '10% rabatt på Tier C event',
  'VIP-garanterad plats (aldrig i kö)',
  'Prioritetskö',
  'Månatlig masterclass',
  'Advanced analytics',
  'Gratis instant payouts',
];

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

export default function PlatinumMemberDashboard({
  subscription,
  discountsSavedThisMonth,
  upcomingMasterclass,
}: PlatinumMemberDashboardProps) {
  const [earlyAccessHours, setEarlyAccessHours] = useState<number | null>(null);

  useEffect(() => {
    function updateCountdown() {
      const now = new Date();
      const hoursRemaining = Math.max(
        0,
        48 - ((now.getTime() % (48 * 60 * 60 * 1000)) / (60 * 60 * 1000))
      );
      setEarlyAccessHours(Math.round(hoursRemaining * 10) / 10);
    }

    updateCountdown();
    const interval = setInterval(updateCountdown, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-5">
      {/* Platinum Badge — premium glow */}
      <div className="relative overflow-hidden rounded-2xl p-6 border border-purple-400/30 bg-gradient-to-br from-purple-600/15 via-[var(--usha-card)] to-indigo-600/10 shadow-[0_0_60px_rgba(168,85,247,0.12),0_0_120px_rgba(168,85,247,0.05)]">
        {/* Animated shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-400/5 to-transparent animate-[shimmer_3s_ease-in-out_infinite] pointer-events-none" />

        {/* Star decoration */}
        <div className="absolute top-0 right-0 w-36 h-36 opacity-10">
          <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
            <polygon
              points="50,2 61,35 95,38 70,60 77,95 50,76 23,95 30,60 5,38 39,35"
              fill="#a855f7"
            />
            <polygon
              points="50,20 56,40 78,42 61,54 66,75 50,64 34,75 39,54 22,42 44,40"
              fill="#c084fc"
            />
          </svg>
        </div>

        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-purple-500/25 to-indigo-500/25 text-purple-300 border border-purple-400/20">
              Platinum Member
            </div>
            <span className="text-xs text-green-500 font-medium">Aktiv</span>
          </div>

          <h2 className="text-2xl font-bold text-purple-200 mb-1">
            Platinum Medlem
          </h2>
          <p className="text-sm text-[var(--usha-muted)]">
            Giltig till {formatDate(subscription.currentPeriodEnd)}
          </p>
        </div>
      </div>

      {/* Savings Card */}
      <div className="rounded-2xl border border-purple-500/15 bg-[var(--usha-card)] p-5 shadow-[0_0_30px_rgba(168,85,247,0.06)]">
        <p className="text-sm text-[var(--usha-muted)] mb-1">
          Totalt sparat denna månad
        </p>
        <p className="text-3xl font-bold text-[var(--usha-white)]">
          {discountsSavedThisMonth.toLocaleString('sv-SE')}{' '}
          <span className="text-lg text-[var(--usha-muted)]">SEK</span>
        </p>
      </div>

      {/* Early Access Countdown */}
      {earlyAccessHours !== null && earlyAccessHours < 48 && (
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[var(--usha-white)]">
                VIP tidigt tillgång aktiv
              </p>
              <p className="text-xs text-[var(--usha-muted)]">
                Boka innan alla andra — garanterad plats
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold font-mono text-purple-400">
                {Math.floor(earlyAccessHours)}h{' '}
                {Math.round((earlyAccessHours % 1) * 60)}m
              </p>
              <p className="text-xs text-[var(--usha-muted)]">kvar</p>
            </div>
          </div>
        </div>
      )}

      {/* VIP Guarantee Banner */}
      <div className="rounded-2xl border border-purple-400/20 bg-gradient-to-r from-purple-600/10 to-indigo-600/10 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-purple-500/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-purple-300">VIP-garanterad plats</p>
          <p className="text-xs text-[var(--usha-muted)]">Du hamnar aldrig i kö — alltid garanterad plats</p>
        </div>
      </div>

      {/* Benefits List */}
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--usha-white)] mb-3">
          Dina Platinum-förmåner
        </h3>
        <ul className="space-y-2.5">
          {PLATINUM_BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-2.5">
              <svg
                className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-400"
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
              <span className="text-sm text-[var(--usha-muted)]">{benefit}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Upcoming Masterclass */}
      {upcomingMasterclass && (
        <div className="rounded-2xl border border-purple-500/20 bg-gradient-to-br from-[var(--usha-card)] to-purple-500/5 p-5">
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
          <Button className="w-full font-semibold bg-purple-600 hover:bg-purple-500 text-white">
            Gå med i masterclass
          </Button>
        </div>
      )}
    </div>
  );
}

export function PlatinumMemberDashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-2xl bg-[var(--usha-card)] border border-purple-500/10 h-36" />
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-24" />
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-16" />
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-72" />
    </div>
  );
}
