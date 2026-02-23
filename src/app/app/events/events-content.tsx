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
  Calendar,
} from "lucide-react";
import Link from "next/link";

interface EventData {
  id: string;
  title: string;
  date: string;
  time: string;
  price: string;
  active: boolean;
  image: string;
  category: string;
}

const EVENT_IMAGES = [
  "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=200&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=250&fit=crop",
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=250&fit=crop",
];

interface ListingData {
  id: string;
  title: string;
  description: string | null;
  category: string;
  price: number | null;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
}

interface EventsContentProps {
  listings: ListingData[];
}

function listingToEvent(listing: ListingData, index: number): EventData {
  const createdDate = new Date(listing.created_at);
  return {
    id: listing.id,
    title: listing.title,
    date: createdDate.toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    time: listing.duration_minutes ? `${listing.duration_minutes} min` : "-",
    price: listing.price ? `${listing.price} kr` : "Gratis",
    active: listing.is_active,
    image: EVENT_IMAGES[index % EVENT_IMAGES.length],
    category: listing.category || "Övrigt",
  };
}

export function EventsContent({ listings }: EventsContentProps) {
  const events = listings.map(listingToEvent);

  const activeCount = events.filter((e) => e.active).length;

  if (events.length === 0) {
    return (
      <div className="px-4 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Mina Evenemang</h1>
          <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
            0 aktiva
          </span>
        </div>

        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
          <Calendar size={40} className="mb-4 text-[var(--usha-muted)]" />
          <p className="text-base font-medium text-[var(--usha-muted)]">
            Inga evenemang ännu
          </p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Skapa ditt första evenemang för att komma igång
          </p>
        </div>

        {/* Add new event */}
        <Link
          href="/dashboard/listings/new"
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
        >
          <Plus size={18} />
          Skapa nytt evenemang
        </Link>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mina Evenemang</h1>
        <span className="rounded-full bg-[var(--usha-gold)]/10 px-3 py-1 text-xs font-medium text-[var(--usha-gold)]">
          {activeCount} aktiva
        </span>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4">
          <Ticket size={16} className="mb-1 text-[var(--usha-gold)]" />
          <p className="text-xl font-bold">{events.length}</p>
          <p className="text-[11px] text-[var(--usha-muted)]">Totalt evenemang</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-gold)]/20 bg-gradient-to-br from-[var(--usha-gold)]/10 to-transparent p-4">
          <TrendingUp size={16} className="mb-1 text-[var(--usha-gold)]" />
          <p className="text-xl font-bold">{activeCount}</p>
          <p className="text-[11px] text-[var(--usha-muted)]">Aktiva</p>
        </div>
      </div>

      {/* Event list */}
      <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0 lg:grid-cols-3">
        {events.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>

      {/* Add new event */}
      <Link
        href="/dashboard/listings/new"
        className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] py-4 text-sm font-medium text-[var(--usha-muted)] transition-colors hover:border-[var(--usha-gold)]/30 hover:text-[var(--usha-gold)]"
      >
        <Plus size={18} />
        Skapa nytt evenemang
      </Link>
    </div>
  );
}

function EventCard({ event }: { event: EventData }) {
  const [showMenu, setShowMenu] = useState(false);

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
        </div>
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-4 text-xs text-[var(--usha-muted)]">
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {event.date}
          </span>
          {event.time !== "-" && (
            <span className="flex items-center gap-1">
              <MapPin size={12} />
              {event.time}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
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
      </div>
    </div>
  );
}
