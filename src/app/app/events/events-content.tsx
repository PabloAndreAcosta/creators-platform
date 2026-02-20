"use client";

import { useState } from "react";
import {
  Users,
  Clock,
  Edit2,
  Trash2,
  Plus,
  MoreVertical,
  MapPin,
  Ticket,
  TrendingUp,
} from "lucide-react";

interface EventData {
  id: string;
  title: string;
  date: string;
  time: string;
  capacity: number;
  sold: number;
  price: string;
  active: boolean;
  image: string;
  category: string;
  creator?: string;
}

const MOCK_EVENTS: EventData[] = [
  {
    id: "1",
    title: "Latin Night",
    date: "15 februari 2026",
    time: "21:00 - 02:00",
    capacity: 150,
    sold: 120,
    price: "249 kr",
    active: true,
    image: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=200&fit=crop",
    category: "Fest & Dans",
    creator: "DJ Carlos & Maria Lindström",
  },
  {
    id: "2",
    title: "Wine & Jazz",
    date: "18 februari 2026",
    time: "19:00 - 22:00",
    capacity: 60,
    sold: 45,
    price: "399 kr",
    active: true,
    image: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=200&fit=crop",
    category: "Musik & Mat",
    creator: "Erik Johansson Quartet",
  },
  {
    id: "3",
    title: "Wellness Retreat",
    date: "22 februari 2026",
    time: "09:00 - 17:00",
    capacity: 20,
    sold: 18,
    price: "1,499 kr",
    active: true,
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=200&fit=crop",
    category: "Wellness",
    creator: "Sofia Andersson",
  },
  {
    id: "4",
    title: "Vårmarknad",
    date: "8 mars 2026",
    time: "10:00 - 18:00",
    capacity: 500,
    sold: 0,
    price: "Gratis",
    active: false,
    image: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop",
    category: "Marknad",
  },
];

export function EventsContent() {
  const [events] = useState(MOCK_EVENTS);

  const totalSold = events.reduce((acc, e) => acc + e.sold, 0);
  const totalRevenue = events
    .filter((e) => e.active)
    .reduce((acc, e) => {
      const price = parseInt(e.price.replace(/[^\d]/g, "")) || 0;
      return acc + price * e.sold;
    }, 0);

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mina Evenemang</h1>
        <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
          {events.filter((e) => e.active).length} aktiva
        </span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4">
          <Ticket size={16} className="mb-1 text-[var(--usha-gold)]" />
          <p className="text-xl font-bold">{totalSold}</p>
          <p className="text-[11px] text-[var(--usha-muted)]">Sålda biljetter</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4">
          <TrendingUp size={16} className="mb-1 text-[var(--usha-gold)]" />
          <p className="text-xl font-bold">{totalRevenue.toLocaleString("sv")} kr</p>
          <p className="text-[11px] text-[var(--usha-muted)]">Intäkter</p>
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* Add new event */}
      <button className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]">
        <Plus size={18} />
        Skapa nytt evenemang
      </button>
    </div>
  );
}

function EventCard({ event }: { event: EventData }) {
  const [showMenu, setShowMenu] = useState(false);
  const fillPercent = (event.sold / event.capacity) * 100;

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-[var(--usha-card)] ${
        event.active ? "border-[var(--usha-border)]" : "border-[var(--usha-border)] opacity-70"
      }`}
    >
      {/* Image */}
      <div className="relative h-36">
        <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            event.active ? "bg-green-500/90 text-white" : "bg-[var(--usha-muted)]/80 text-white"
          }`}
        >
          {event.active ? "Aktiv" : "Utkast"}
        </span>

        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
          {event.category}
        </span>

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-base font-bold text-white">{event.title}</h3>
          {event.creator && (
            <p className="text-xs text-white/70">med {event.creator}</p>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-4 text-xs text-[var(--usha-muted)]">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {event.date}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {event.time}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-[var(--usha-gold)]" />
              <span className="text-sm font-medium">
                {event.sold}
                <span className="text-[var(--usha-muted)]">/{event.capacity}</span>
              </span>
            </div>
            <span className="rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-xs font-medium text-[var(--usha-gold)]">
              {event.price}
            </span>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="rounded-lg p-2 text-[var(--usha-muted)] hover:bg-[var(--usha-card-hover)] hover:text-white"
            >
              <MoreVertical size={16} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                <div className="absolute bottom-full right-0 z-20 mb-1 rounded-lg border border-[var(--usha-border)] bg-[var(--usha-card)] py-1 shadow-xl">
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-xs hover:bg-[var(--usha-card-hover)]">
                    <Edit2 size={12} />
                    Redigera
                  </button>
                  <button className="flex w-full items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-[var(--usha-card-hover)]">
                    <Trash2 size={12} />
                    Ta bort
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Capacity bar */}
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--usha-border)]">
            <div
              className={`h-full rounded-full ${
                fillPercent > 90
                  ? "bg-gradient-to-r from-orange-400 to-red-400"
                  : "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)]"
              }`}
              style={{ width: `${fillPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
