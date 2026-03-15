"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch unread count on mount + poll every 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications?limit=10");
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      // ignore
    }
  }

  async function markAllRead() {
    setLoading(true);
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  }

  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "nu";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen(!open);
          if (!open) fetchNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/10"
        aria-label="Notifikationer"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--usha-gold)] px-1 text-[10px] font-bold text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--usha-border)] px-4 py-3">
            <h3 className="text-sm font-semibold">Notifikationer</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                disabled={loading}
                className="flex items-center gap-1 text-[10px] font-medium text-[var(--usha-gold)] transition hover:opacity-80 disabled:opacity-50"
              >
                <CheckCheck size={12} />
                Markera alla lästa
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[var(--usha-muted)]">
                Inga notifikationer ännu
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-3 border-b border-[var(--usha-border)] px-4 py-3 last:border-0 ${
                    !n.is_read ? "bg-[var(--usha-gold)]/5" : ""
                  }`}
                >
                  {/* Unread dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    {!n.is_read ? (
                      <div className="h-2 w-2 rounded-full bg-[var(--usha-gold)]" />
                    ) : (
                      <div className="h-2 w-2" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold">{n.title}</p>
                      <span className="flex-shrink-0 text-[10px] text-[var(--usha-muted)]">
                        {timeAgo(n.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--usha-muted)] line-clamp-2">
                      {n.message}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      {n.link && (
                        <Link
                          href={n.link}
                          onClick={() => {
                            if (!n.is_read) markRead(n.id);
                            setOpen(false);
                          }}
                          className="flex items-center gap-1 text-[10px] font-medium text-[var(--usha-gold)] hover:opacity-80"
                        >
                          <ExternalLink size={10} />
                          Visa
                        </Link>
                      )}
                      {!n.is_read && (
                        <button
                          onClick={() => markRead(n.id)}
                          className="flex items-center gap-1 text-[10px] text-[var(--usha-muted)] hover:text-white"
                        >
                          <Check size={10} />
                          Läst
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
