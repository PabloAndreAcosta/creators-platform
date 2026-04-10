"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSubscription } from "@/lib/subscription/context";
import {
  Users,
  Ticket,
  DollarSign,
  TrendingUp,
  Search,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  ArrowLeft,
  Radio,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface EventData {
  id: string;
  title: string;
  date: string | null;
  time: string | null;
  endTime: string | null;
  location: string | null;
  capacity: number | null;
  price: number | null;
}

interface Stats {
  totalTickets: number;
  totalGuests: number;
  checkedIn: number;
  checkedInGuests: number;
  totalRevenue: number;
  checkInRate: number;
  capacity: number | null;
}

interface CheckIn {
  id: string;
  name: string;
  checkedInAt: string;
  guestCount: number;
}

interface Guest {
  id: string;
  name: string;
  email: string | null;
  guestCount: number;
  checkedIn: boolean;
  checkedInAt: string | null;
  amountPaid: number;
  bookedAt: string;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

export default function LiveEventPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations("eventLive");
  const { tier } = useSubscription();
  const [event, setEvent] = useState<EventData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentCheckIns, setRecentCheckIns] = useState<CheckIn[]>([]);
  const [guestList, setGuestList] = useState<Guest[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}/live`);
      if (!res.ok) {
        setError("Could not load event data");
        return;
      }
      const data = await res.json();
      setEvent(data.event);
      setStats(data.stats);
      setRecentCheckIns(data.recentCheckIns);
      setGuestList(data.guestList);
      setLastUpdated(new Date());
      setError(null);
    } catch {
      setError("Connection lost");
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Initial fetch + polling every 10 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Premium gate
  if (tier === "gratis") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Radio size={48} className="mb-4 text-[var(--usha-gold)]" />
        <h2 className="text-xl font-bold mb-2">{t("premiumFeature")}</h2>
        <p className="text-[var(--usha-muted)] mb-4">{t("upgradeToAccess")}</p>
        <Link
          href="/dashboard/billing"
          className="rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black"
        >
          {t("upgrade")}
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

  if (error || !event || !stats) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <p className="text-[var(--usha-muted)]">{error || "Event not found"}</p>
        <Link href="/app/events" className="mt-4 text-sm text-[var(--usha-gold)]">
          {t("backToEvents")}
        </Link>
      </div>
    );
  }

  const filteredGuests = guestList.filter(
    (g) =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (g.email && g.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const progressPercent = stats.capacity
    ? Math.min((stats.checkedInGuests / stats.capacity) * 100, 100)
    : stats.totalGuests > 0
      ? (stats.checkedInGuests / stats.totalGuests) * 100
      : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/app/events"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          {t("backToEvents")}
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[var(--usha-muted)]">
              {event.date && (
                <span className="flex items-center gap-1">
                  <Calendar size={13} />
                  {new Date(event.date).toLocaleDateString("sv-SE", {
                    day: "numeric",
                    month: "short",
                  })}
                  {event.time && ` ${event.time}`}
                </span>
              )}
              {event.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={13} />
                  {event.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/app/scan"
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2.5 text-sm font-bold text-black"
            >
              <ScanLine size={16} />
              {t("scanTicket")}
            </Link>
          </div>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-[var(--usha-muted)]">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        {t("liveUpdating")} · {t("lastUpdated")} {timeAgo(lastUpdated.toISOString())}
      </div>

      {/* Main check-in circle */}
      <div className="flex flex-col items-center rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8">
        <div className="relative h-40 w-40">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              stroke="var(--usha-border)"
              strokeWidth="8"
              fill="none"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              stroke="var(--usha-gold)"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - progressPercent / 100)}`}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold">{stats.checkedInGuests}</span>
            <span className="text-xs text-[var(--usha-muted)]">
              / {stats.capacity || stats.totalGuests} {t("checkedIn")}
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm text-[var(--usha-muted)]">
          {t("checkInRate")}: {stats.checkInRate}%
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-center">
          <Ticket size={18} className="mx-auto mb-1 text-[var(--usha-gold)]" />
          <p className="text-xl font-bold">{stats.totalTickets}</p>
          <p className="text-[10px] text-[var(--usha-muted)]">{t("ticketsSold")}</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-center">
          <Users size={18} className="mx-auto mb-1 text-[var(--usha-gold)]" />
          <p className="text-xl font-bold">{stats.checkedIn}</p>
          <p className="text-[10px] text-[var(--usha-muted)]">{t("checkedInCount")}</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-center">
          <DollarSign size={18} className="mx-auto mb-1 text-[var(--usha-gold)]" />
          <p className="text-xl font-bold">{Math.round(stats.totalRevenue / 100).toLocaleString("sv-SE")}</p>
          <p className="text-[10px] text-[var(--usha-muted)]">{t("revenue")} (SEK)</p>
        </div>
      </div>

      {/* Recent check-ins */}
      {recentCheckIns.length > 0 && (
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--usha-border)] px-4 py-3">
            <h3 className="text-sm font-semibold">{t("recentCheckIns")}</h3>
            <TrendingUp size={14} className="text-green-400" />
          </div>
          <div className="divide-y divide-[var(--usha-border)]">
            {recentCheckIns.map((ci) => (
              <div key={ci.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-green-400" />
                  <span className="text-sm">{ci.name}</span>
                  {ci.guestCount > 1 && (
                    <span className="text-[10px] text-[var(--usha-muted)]">
                      +{ci.guestCount - 1}
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--usha-muted)]">
                  {timeAgo(ci.checkedInAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guest list */}
      <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] overflow-hidden">
        <div className="border-b border-[var(--usha-border)] px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">{t("guestList")}</h3>
            <span className="text-xs text-[var(--usha-muted)]">
              {guestList.length} {t("guests")}
            </span>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--usha-muted)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchGuests")}
              className="w-full rounded-lg border border-[var(--usha-border)] bg-[var(--usha-black)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--usha-gold)]/40"
            />
          </div>
        </div>
        <div className="max-h-80 overflow-y-auto divide-y divide-[var(--usha-border)]">
          {filteredGuests.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--usha-muted)]">
              {t("noGuests")}
            </div>
          ) : (
            filteredGuests.map((guest) => (
              <div
                key={guest.id}
                className={cn(
                  "flex items-center justify-between px-4 py-3",
                  guest.checkedIn && "bg-green-500/5"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      guest.checkedIn
                        ? "bg-green-500/20 text-green-400"
                        : "bg-[var(--usha-border)] text-[var(--usha-muted)]"
                    )}
                  >
                    {guest.checkedIn ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      guest.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{guest.name}</p>
                    <p className="text-[10px] text-[var(--usha-muted)]">
                      {guest.guestCount > 1 && `${guest.guestCount} ${t("guests")} · `}
                      {guest.checkedIn && guest.checkedInAt
                        ? `${t("checkedInAt")} ${new Date(guest.checkedInAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}`
                        : t("notCheckedIn")}
                    </p>
                  </div>
                </div>
                {guest.amountPaid > 0 && (
                  <span className="text-xs text-[var(--usha-muted)]">
                    {Math.round(guest.amountPaid / 100)} kr
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
