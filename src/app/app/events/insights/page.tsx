"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, Users, Repeat, UserPlus, CheckCircle2, Download, Radio } from "lucide-react";
import { useSubscription } from "@/lib/subscription/context";

interface TopReturning {
  name: string;
  email: string | null;
  eventsCount: number;
  lastSeen: string;
}
interface PerEvent {
  id: string;
  title: string;
  eventDate: string | null;
  bookings: number;
  checkedIn: number;
}
interface Insights {
  uniqueAttendees: number;
  returning: number;
  new: number;
  returningRate: number;
  totalCheckedIn: number;
  totalBookings: number;
  eventCount: number;
  topReturning: TopReturning[];
  perEvent: PerEvent[];
}

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  const x = new Date(d + "T12:00:00+02:00");
  return isNaN(x.getTime()) ? "—" : x.toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });
}

export default function InsightsPage() {
  const { tier } = useSubscription();
  const [data, setData] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/insights`);
      if (!res.ok) {
        setError("Kunde inte hämta statistik");
        return;
      }
      setData(await res.json());
      setError(null);
    } catch {
      setError("Anslutningsfel");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function exportCsv() {
    if (!data) return;
    const rows = [
      ["Namn", "E-post", "Antal event", "Senast"],
      ...data.topReturning.map((a) => [a.name, a.email ?? "", String(a.eventsCount), fmtDate(a.lastSeen?.slice(0, 10) ?? null)]),
    ];
    const csv = rows.map((r) => r.map((c) => csvEscape(c)).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "aterkommande-deltagare.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (tier === "gratis") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Radio size={48} className="mb-4 text-[var(--usha-gold)]" />
        <h2 className="mb-2 text-xl font-bold">Statistik är en Premium-funktion</h2>
        <Link href="/dashboard/billing" className="mt-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black">
          Uppgradera
        </Link>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--usha-gold)] border-t-transparent" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-[var(--usha-muted)]">{error || "Hittades inte"}</p>
        <Link href="/app/events" className="mt-4 text-sm text-[var(--usha-gold)]">Till evenemang</Link>
      </div>
    );
  }

  const cards = [
    { icon: Users, label: "Unika deltagare", value: data.uniqueAttendees },
    { icon: Repeat, label: `Återkommande (${data.returningRate}%)`, value: data.returning },
    { icon: UserPlus, label: "Nya", value: data.new },
    { icon: CheckCircle2, label: "Incheckningar", value: data.totalCheckedIn },
  ];

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <div>
        <Link href="/app/events" className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]">
          <ArrowLeft size={14} /> Evenemang
        </Link>
        <h1 className="text-2xl font-bold">Statistik – översikt</h1>
        <p className="mt-1 text-sm text-[var(--usha-muted)]">Över alla dina {data.eventCount} event</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-center">
            <c.icon size={18} className="mx-auto mb-1 text-[var(--usha-gold)]" />
            <p className="text-xl font-bold">{c.value}</p>
            <p className="text-[10px] text-[var(--usha-muted)]">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Top returning */}
      <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--usha-border)] px-4 py-3">
          <h3 className="text-sm font-semibold">Återkommande deltagare</h3>
          {data.topReturning.length > 0 && (
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium transition hover:border-[var(--usha-gold)]/50">
              <Download size={13} /> CSV
            </button>
          )}
        </div>
        {data.topReturning.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[var(--usha-muted)]">Inga återkommande deltagare ännu.</p>
        ) : (
          <div className="divide-y divide-[var(--usha-border)]">
            {data.topReturning.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--usha-gold)]/15 text-xs font-bold text-[var(--usha-gold)]">
                  {(a.name.charAt(0) || "?").toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--usha-white)]">{a.name}</p>
                  {a.email && <p className="truncate text-[11px] text-[var(--usha-muted)]">{a.email}</p>}
                </div>
                <span className="shrink-0 text-xs font-semibold text-[var(--usha-gold)]">{a.eventsCount} event</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-event summary */}
      {data.perEvent.length > 0 && (
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
          <div className="border-b border-[var(--usha-border)] px-4 py-3">
            <h3 className="text-sm font-semibold">Per event</h3>
          </div>
          <div className="divide-y divide-[var(--usha-border)]">
            {data.perEvent.map((e) => (
              <Link key={e.id} href={`/app/events/${e.id}/stats`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--usha-card-hover)]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--usha-white)]">{e.title}</p>
                  <p className="text-[11px] text-[var(--usha-muted)]">{fmtDate(e.eventDate)}</p>
                </div>
                <span className="shrink-0 text-xs text-[var(--usha-muted)]">
                  <span className="font-semibold text-green-400">{e.checkedIn}</span> / {e.bookings}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
