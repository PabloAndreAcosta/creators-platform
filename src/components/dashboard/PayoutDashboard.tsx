'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

interface PayoutRecord {
  id: string;
  amount_gross: number;
  amount_commission: number;
  amount_net: number;
  payout_type: 'batch' | 'instant';
  status: 'pending' | 'in_transit' | 'paid' | 'failed';
  created_at: string;
  paid_at: string | null;
}

interface PayoutDashboardProps {
  creatorId: string;
}

function sek(amount: number): string {
  return amount.toLocaleString('sv-SE', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(dateStr));
}

const STATUS_META: Record<string, { labelKey: string; color: string }> = {
  pending: { labelKey: 'statusPending', color: 'text-yellow-400' },
  in_transit: { labelKey: 'statusInTransit', color: 'text-blue-400' },
  paid: { labelKey: 'statusPaid', color: 'text-green-400' },
  failed: { labelKey: 'statusFailed', color: 'text-red-400' },
};

const COMMISSION_RATES: Record<string, number> = {
  gratis: 0.15,
  guld: 0.08,
  premium: 0.03,
};

export default function PayoutDashboard({ creatorId }: PayoutDashboardProps) {
  const t = useTranslations('payouts');
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string>('gratis');
  const [weeklyGross, setWeeklyGross] = useState(0);
  const [lifetimeGross, setLifetimeGross] = useState(0);
  const [lifetimeCommission, setLifetimeCommission] = useState(0);
  const [lifetimeNet, setLifetimeNet] = useState(0);
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [instantCount, setInstantCount] = useState(0);
  const [availableBalance, setAvailableBalance] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

  const payoutModalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    document.addEventListener('keydown', handleKey);
    payoutModalRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKey);
  }, [showModal]);

  const commissionRate = COMMISSION_RATES[tier] ?? 0.15;
  const weeklyCommission = Math.round(weeklyGross * commissionRate);
  const weeklyNet = weeklyGross - weeklyCommission;
  const instantFee = instantCount >= 1;

  const fetchData = useCallback(async () => {
    // Use the shared singleton — a second createBrowserClient() spawns another
    // GoTrue instance that fights the singleton for the auth-token Web Lock.
    const supabase = createClient();

    // Get creator tier
    const { data: profile } = await supabase
      .from('profiles')
      .select('tier')
      .eq('id', creatorId)
      .single();

    if (profile?.tier) setTier(profile.tier);

    // Weekly earnings (completed bookings this week)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: weekBookings } = await supabase
      .from('bookings')
      .select('listing_id, listings(price)')
      .eq('creator_id', creatorId)
      .eq('status', 'completed')
      .gte('updated_at', weekAgo.toISOString());

    const weekTotal = (weekBookings ?? []).reduce(
      (sum, b) => sum + ((b.listings as unknown as { price: number })?.price ?? 0),
      0
    );
    setWeeklyGross(weekTotal);

    // Payout history
    const { data: payoutData } = await supabase
      .from('payouts')
      .select('*')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false });

    const records = (payoutData ?? []) as PayoutRecord[];
    setPayouts(records);

    // Lifetime totals from payouts
    let totalGross = 0;
    let totalCommission = 0;
    let totalNet = 0;
    for (const p of records) {
      totalGross += Number(p.amount_gross);
      totalCommission += Number(p.amount_commission);
      totalNet += Number(p.amount_net);
    }
    setLifetimeGross(totalGross);
    setLifetimeCommission(totalCommission);
    setLifetimeNet(totalNet);

    // Instant payout count this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await supabase
      .from('payouts')
      .select('id', { count: 'exact', head: true })
      .eq('creator_id', creatorId)
      .eq('payout_type', 'instant')
      .gte('created_at', startOfMonth.toISOString());

    setInstantCount(count ?? 0);

    // Available balance = weekly earnings not yet paid out
    setAvailableBalance(weekTotal);

    setLoading(false);
  }, [creatorId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleInstantPayout() {
    setPayoutLoading(true);
    try {
      const res = await fetch('/api/payouts/instant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, amount: availableBalance }),
      });
      const data = await res.json();
      if (data.success) {
        setShowModal(false);
        fetchData();
      } else {
        console.error('Instant payout failed:', data.error);
      }
    } catch (err) {
      console.error('Instant payout error:', err);
    } finally {
      setPayoutLoading(false);
    }
  }

  if (loading) return <PayoutDashboardSkeleton />;

  const feeAmount = instantFee ? Math.round(availableBalance * 0.01) : 0;
  const payoutNet = availableBalance - feeAmount;

  return (
    <div className="space-y-5">
      {/* Weekly Earnings Card */}
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--usha-muted)]">
            {t("thisWeek")}
          </h3>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
            {t("commissionBadge", { percent: Math.round(commissionRate * 100) })}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-[var(--usha-muted)]">{t("gross")}</span>
            <span className="text-[var(--usha-white)]">{t("amountSek", { amount: sek(weeklyGross) })}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[var(--usha-muted)]">{t("commission")}</span>
            <span className="text-red-400">{t("amountSekNegative", { amount: sek(weeklyCommission) })}</span>
          </div>
          <div className="h-px bg-[var(--usha-border)]" />
          <div className="flex justify-between">
            <span className="text-sm font-medium text-[var(--usha-white)]">{t("net")}</span>
            <span className="text-xl font-bold text-[var(--usha-gold)]">
              {t("amountSek", { amount: sek(weeklyNet) })}
            </span>
          </div>
        </div>
        <p className="text-xs text-[var(--usha-muted)] mt-3">
          {t("nextPayout")}
        </p>
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { labelKey: 'statTotalEarned', value: lifetimeGross },
          { labelKey: 'statCommission', value: lifetimeCommission },
          { labelKey: 'statPaidOut', value: lifetimeNet },
        ].map((stat) => (
          <div
            key={stat.labelKey}
            className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-3 text-center"
          >
            <p className="text-xs text-[var(--usha-muted)] mb-1">{t(stat.labelKey)}</p>
            <p className="text-sm font-bold text-[var(--usha-white)]">
              {sek(stat.value)}
            </p>
          </div>
        ))}
      </div>

      {/* Instant Payout Button */}
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--usha-white)]">
              {t("instantTitle")}
            </h3>
            <p className="text-xs text-[var(--usha-muted)] mt-0.5">
              {instantCount === 0
                ? t("instantHintFree")
                : t("instantHintUsed", { count: instantCount })}
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          disabled={availableBalance <= 0}
          className="w-full bg-[var(--usha-gold)] hover:bg-[var(--usha-gold-light)] text-black font-semibold"
        >
          {t("withdrawNow", { amount: sek(availableBalance) })}
        </Button>
      </div>

      {/* Payout History */}
      <div className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
        <h3 className="text-sm font-semibold text-[var(--usha-white)] mb-3">
          {t("historyTitle")}
        </h3>
        {payouts.length === 0 ? (
          <p className="text-sm text-[var(--usha-muted)] text-center py-6">
            {t("historyEmpty")}
          </p>
        ) : (
          <div className="space-y-3">
            {payouts.map((p) => {
              const status = STATUS_META[p.status] ?? STATUS_META.pending;
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[var(--usha-black)]/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-[var(--usha-white)]">
                        {p.payout_type === 'instant' ? t("typeInstant") : t("typeWeekly")}
                      </span>
                      <span className={cn('text-xs font-medium', status.color)}>
                        {t(status.labelKey)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--usha-muted)]">
                      {formatDate(p.created_at)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-[var(--usha-white)]">
                      {t("amountSek", { amount: sek(Number(p.amount_net)) })}
                    </p>
                    <p className="text-xs text-[var(--usha-muted)]">
                      {t("historyOf", { amount: sek(Number(p.amount_gross)) })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instant Payout Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            ref={payoutModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="payout-modal-title"
            tabIndex={-1}
            className="w-full max-w-md bg-[var(--usha-card)] border border-[var(--usha-border)] rounded-t-2xl sm:rounded-2xl p-6 space-y-4 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 id="payout-modal-title" className="text-lg font-bold text-[var(--usha-white)]">
                {t("instantTitle")}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="flex h-11 w-11 items-center justify-center rounded-lg text-[var(--usha-muted)] hover:text-[var(--usha-white)]"
                aria-label={t("modalClose")}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--usha-muted)]">{t("available")}</span>
                <span className="text-[var(--usha-white)]">{t("amountSek", { amount: sek(availableBalance) })}</span>
              </div>
              {instantFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--usha-muted)]">{t("fee")}</span>
                  <span className="text-red-400">{t("amountSekNegative", { amount: sek(feeAmount) })}</span>
                </div>
              )}
              <div className="h-px bg-[var(--usha-border)]" />
              <div className="flex justify-between">
                <span className="text-sm font-medium text-[var(--usha-white)]">
                  {t("youGet")}
                </span>
                <span className="text-xl font-bold text-[var(--usha-gold)]">
                  {t("amountSek", { amount: sek(payoutNet) })}
                </span>
              </div>
            </div>

            <p className="text-xs text-[var(--usha-muted)]">
              {t("moneyArrival")}
            </p>

            <Button
              onClick={handleInstantPayout}
              disabled={payoutLoading || payoutNet <= 0}
              className="w-full bg-[var(--usha-gold)] hover:bg-[var(--usha-gold-light)] text-black font-semibold"
            >
              {payoutLoading ? t("processing") : t("confirmWithdraw")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PayoutDashboardSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-44" />
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-16" />
        ))}
      </div>
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-24" />
      <div className="rounded-2xl bg-[var(--usha-card)] border border-[var(--usha-border)] h-48" />
    </div>
  );
}
