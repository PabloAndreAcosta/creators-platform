"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  Loader2,
  CreditCard,
  Calendar,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalBookings: number;
    completionRate: number;
    currentMonthRevenue: number;
    currentMonthBookings: number;
    prevMonthRevenue: number;
    prevMonthBookings: number;
  };
  monthlyStats: {
    month: string;
    revenue: number;
    bookings: number;
    completed: number;
  }[];
  topServices: {
    title: string;
    category: string;
    count: number;
    revenue: number;
  }[];
  statusCounts: {
    pending: number;
    confirmed: number;
    completed: number;
    canceled: number;
  };
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "Maj", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec",
];

function formatMonth(ym: string) {
  const [, m] = ym.split("-");
  return MONTH_NAMES[parseInt(m, 10) - 1] || m;
}

function TrendBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return (
    <span className="flex items-center gap-0.5 text-[10px] font-medium text-green-400">
      <TrendingUp size={10} /> Ny
    </span>
  );
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return null;
  return (
    <span className={`flex items-center gap-0.5 text-[10px] font-medium ${pct > 0 ? "text-green-400" : "text-red-400"}`}>
      {pct > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
      {pct > 0 ? "+" : ""}{pct}%
    </span>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[var(--usha-muted)]" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-sm text-[var(--usha-muted)]">
        Kunde inte ladda analytics.
      </div>
    );
  }

  const { summary, monthlyStats, topServices, statusCounts } = data;
  const maxRevenue = Math.max(...monthlyStats.map((m) => m.revenue), 1);
  const maxBookings = Math.max(...monthlyStats.map((m) => m.bookings), 1);

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <div className="flex items-center gap-3">
          <BarChart3 size={24} className="text-[var(--usha-gold)]" />
          <h1 className="text-3xl font-bold">Analytics</h1>
        </div>
        <p className="mt-1 text-[var(--usha-muted)]">
          Översikt av dina bokningar och intäkter de senaste 6 månaderna.
        </p>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-[var(--usha-muted)]">Intäkter denna månad</span>
            <CreditCard size={14} className="text-[var(--usha-muted)]" />
          </div>
          <p className="text-2xl font-bold">{summary.currentMonthRevenue} SEK</p>
          <TrendBadge current={summary.currentMonthRevenue} previous={summary.prevMonthRevenue} />
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-[var(--usha-muted)]">Bokningar denna månad</span>
            <Calendar size={14} className="text-[var(--usha-muted)]" />
          </div>
          <p className="text-2xl font-bold">{summary.currentMonthBookings}</p>
          <TrendBadge current={summary.currentMonthBookings} previous={summary.prevMonthBookings} />
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-[var(--usha-muted)]">Totala intäkter</span>
            <CreditCard size={14} className="text-[var(--usha-muted)]" />
          </div>
          <p className="text-2xl font-bold">{summary.totalRevenue} SEK</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs text-[var(--usha-muted)]">Slutförandegrad</span>
            <CheckCircle size={14} className="text-[var(--usha-muted)]" />
          </div>
          <p className="text-2xl font-bold">{summary.completionRate}%</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="mb-8 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
        <h2 className="mb-4 text-sm font-semibold">Intäkter per månad</h2>
        <div className="flex items-end gap-2 h-40">
          {monthlyStats.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-[var(--usha-muted)]">
                {m.revenue > 0 ? `${m.revenue}` : ""}
              </span>
              <div
                className="w-full rounded-t bg-gradient-to-t from-[var(--usha-gold)] to-[var(--usha-accent)] transition-all"
                style={{
                  height: `${Math.max((m.revenue / maxRevenue) * 100, 2)}%`,
                  minHeight: "4px",
                }}
              />
              <span className="text-[10px] text-[var(--usha-muted)]">
                {formatMonth(m.month)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bookings chart */}
      <div className="mb-8 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
        <h2 className="mb-4 text-sm font-semibold">Bokningar per månad</h2>
        <div className="flex items-end gap-2 h-32">
          {monthlyStats.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] text-[var(--usha-muted)]">
                {m.bookings > 0 ? m.bookings : ""}
              </span>
              <div
                className="w-full rounded-t bg-blue-500/80 transition-all"
                style={{
                  height: `${Math.max((m.bookings / maxBookings) * 100, 2)}%`,
                  minHeight: "4px",
                }}
              />
              <span className="text-[10px] text-[var(--usha-muted)]">
                {formatMonth(m.month)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top services */}
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
          <h2 className="mb-4 text-sm font-semibold">Populäraste tjänster</h2>
          {topServices.length === 0 ? (
            <p className="text-xs text-[var(--usha-muted)]">Inga bokningar ännu</p>
          ) : (
            <div className="space-y-3">
              {topServices.map((s, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <p className="text-[10px] text-[var(--usha-muted)]">
                      {s.count} bokningar &middot; {s.revenue} SEK
                    </p>
                  </div>
                  <div className="ml-4 flex-shrink-0">
                    <div className="h-2 w-20 rounded-full bg-[var(--usha-border)]">
                      <div
                        className="h-2 rounded-full bg-[var(--usha-gold)]"
                        style={{
                          width: `${(s.count / topServices[0].count) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Status breakdown */}
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
          <h2 className="mb-4 text-sm font-semibold">Bokningsstatus</h2>
          <div className="space-y-3">
            {[
              { label: "Väntande", count: statusCounts.pending, color: "bg-yellow-500" },
              { label: "Bekräftade", count: statusCounts.confirmed, color: "bg-blue-500" },
              { label: "Slutförda", count: statusCounts.completed, color: "bg-green-500" },
              { label: "Avbokade", count: statusCounts.canceled, color: "bg-red-500" },
            ].map((s) => {
              const total = summary.totalBookings || 1;
              return (
                <div key={s.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[var(--usha-muted)]">{s.label}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[var(--usha-border)]">
                    <div
                      className={`h-1.5 rounded-full ${s.color}`}
                      style={{ width: `${(s.count / total) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
