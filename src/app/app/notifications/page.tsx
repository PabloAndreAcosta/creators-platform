"use client";

import { useState, useEffect } from "react";
import { Bell, Check, CheckCheck, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_ICONS: Record<string, string> = {
  booking_new: "📅",
  booking_confirmed: "✅",
  booking_canceled: "❌",
  payout: "💰",
  review: "⭐",
  queue_promoted: "🎉",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications?limit=50");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just nu";
    if (mins < 60) return `${mins} min sedan`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h sedan`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d sedan`;
    return new Date(dateStr).toLocaleDateString("sv-SE");
  }

  const filtered = filter === "unread"
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  return (
    <div className="px-4 py-6 space-y-6 md:max-w-2xl md:mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell size={24} className="text-[var(--usha-gold)]" />
          <div>
            <h1 className="text-2xl font-bold">Notifikationer</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-[var(--usha-muted)]">
                {unreadCount} olästa
              </p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--usha-border)] px-3 py-1.5 text-xs font-medium text-[var(--usha-muted)] transition hover:text-white"
          >
            <CheckCheck size={14} />
            Markera alla lästa
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-[var(--usha-border)] p-0.5 w-fit">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "bg-[var(--usha-card)] text-white shadow-sm"
                : "text-[var(--usha-muted)] hover:text-white"
            }`}
          >
            {f === "all" ? "Alla" : "Olästa"}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin text-[var(--usha-muted)]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--usha-border)] py-16 text-center">
          <Bell size={32} className="mx-auto mb-3 text-[var(--usha-muted)]" />
          <p className="text-sm text-[var(--usha-muted)]">
            {filter === "unread" ? "Inga olästa notifikationer" : "Inga notifikationer ännu"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border p-4 transition ${
                !n.is_read
                  ? "border-[var(--usha-gold)]/20 bg-[var(--usha-gold)]/5"
                  : "border-[var(--usha-border)] bg-[var(--usha-card)]"
              }`}
            >
              <div className="flex gap-3">
                <span className="mt-0.5 text-lg">
                  {TYPE_ICONS[n.type] || "🔔"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{n.title}</h3>
                    <span className="flex-shrink-0 text-[10px] text-[var(--usha-muted)]">
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[var(--usha-muted)]">{n.message}</p>
                  <div className="mt-2 flex items-center gap-3">
                    {n.link && (
                      <Link
                        href={n.link}
                        onClick={() => { if (!n.is_read) markRead(n.id); }}
                        className="flex items-center gap-1 text-xs font-medium text-[var(--usha-gold)] hover:opacity-80"
                      >
                        <ExternalLink size={11} />
                        Visa
                      </Link>
                    )}
                    {!n.is_read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="flex items-center gap-1 text-xs text-[var(--usha-muted)] hover:text-white"
                      >
                        <Check size={11} />
                        Markera som läst
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
