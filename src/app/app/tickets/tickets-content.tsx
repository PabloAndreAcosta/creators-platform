"use client";

import { useState } from "react";
import { Calendar, MapPin, Clock, QrCode, X, Ticket } from "lucide-react";

interface TicketData {
  id: string;
  code: string;
  title: string;
  date: string;
  time: string;
  location: string;
  status: "active" | "used" | "upcoming";
  type: string;
}

const MOCK_TICKETS: TicketData[] = [
  {
    id: "1",
    code: "USH-2026-4821",
    title: "Street Dance Workshop",
    date: "15 februari 2026",
    time: "18:00 - 19:30",
    location: "Dansens Hus, Stockholm",
    status: "active",
    type: "Workshop",
  },
  {
    id: "2",
    code: "USH-2026-4935",
    title: "Summer Salsa Social",
    date: "18 februari 2026",
    time: "20:00 - 23:00",
    location: "Club Havana, Malmö",
    status: "active",
    type: "Social",
  },
  {
    id: "3",
    code: "USH-2026-5102",
    title: "Akustisk Kväll",
    date: "20 februari 2026",
    time: "19:00 - 21:00",
    location: "Malmö Live",
    status: "upcoming",
    type: "Konsert",
  },
  {
    id: "4",
    code: "USH-2026-3847",
    title: "Bachata Bootcamp",
    date: "5 januari 2026",
    time: "10:00 - 16:00",
    location: "Dansens Hus, Stockholm",
    status: "used",
    type: "Workshop",
  },
  {
    id: "5",
    code: "USH-2026-3621",
    title: "Nyårskonsert",
    date: "31 december 2025",
    time: "21:00 - 01:00",
    location: "Konserthuset, Göteborg",
    status: "used",
    type: "Konsert",
  },
];

export function TicketsContent() {
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);

  const activeTickets = MOCK_TICKETS.filter(
    (t) => t.status === "active" || t.status === "upcoming"
  );
  const usedTickets = MOCK_TICKETS.filter((t) => t.status === "used");

  return (
    <div className="px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold">Mina Biljetter</h1>

      {/* Active Tickets */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
          Aktiva Biljetter
        </h2>
        <div className="space-y-4">
          {activeTickets.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onShowQR={() => setSelectedTicket(ticket)}
            />
          ))}
        </div>
      </section>

      {/* Used Tickets */}
      {usedTickets.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
            Använda Biljetter
          </h2>
          <div className="space-y-4 opacity-60">
            {usedTickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </div>
        </section>
      )}

      {/* QR Code Modal */}
      {selectedTicket && (
        <QRModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
        />
      )}
    </div>
  );
}

function TicketCard({
  ticket,
  onShowQR,
}: {
  ticket: TicketData;
  onShowQR?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)]">
      {/* Ticket top */}
      <div className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{ticket.title}</h3>
            <span className="mt-1 inline-block rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] font-medium text-[var(--usha-gold)]">
              {ticket.type}
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              ticket.status === "active"
                ? "bg-green-500/20 text-green-400"
                : ticket.status === "upcoming"
                  ? "bg-blue-500/20 text-blue-400"
                  : "bg-[var(--usha-muted)]/20 text-[var(--usha-muted)]"
            }`}
          >
            {ticket.status === "active"
              ? "Aktiv"
              : ticket.status === "upcoming"
                ? "Kommande"
                : "Använd"}
          </span>
        </div>

        <div className="space-y-1.5 text-xs text-[var(--usha-muted)]">
          <div className="flex items-center gap-2">
            <Calendar size={12} />
            <span>{ticket.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock size={12} />
            <span>{ticket.time}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin size={12} />
            <span>{ticket.location}</span>
          </div>
        </div>
      </div>

      {/* Ticket divider (perforated line effect) */}
      <div className="relative flex items-center">
        <div className="absolute -left-3 h-6 w-6 rounded-full bg-[var(--usha-black)]" />
        <div className="flex-1 border-t border-dashed border-[var(--usha-border)]" />
        <div className="absolute -right-3 h-6 w-6 rounded-full bg-[var(--usha-black)]" />
      </div>

      {/* Ticket bottom */}
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="font-mono text-xs text-[var(--usha-muted)]">
            {ticket.code}
          </p>
        </div>
        {ticket.status !== "used" && onShowQR && (
          <button
            onClick={onShowQR}
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-3 py-2 text-xs font-semibold text-black transition-opacity hover:opacity-90"
          >
            <QrCode size={14} />
            Visa QR-kod
          </button>
        )}
      </div>
    </div>
  );
}

function QRModal({
  ticket,
  onClose,
}: {
  ticket: TicketData;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-lg font-bold">Din Biljett</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 hover:bg-[var(--usha-card-hover)]"
          >
            <X size={18} className="text-[var(--usha-muted)]" />
          </button>
        </div>

        {/* QR Code placeholder */}
        <div className="mb-6 flex items-center justify-center">
          <div className="rounded-2xl border-2 border-[var(--usha-gold)]/30 bg-white p-4">
            <svg
              width="180"
              height="180"
              viewBox="0 0 180 180"
              className="text-black"
            >
              {/* Simplified QR code pattern */}
              <rect width="180" height="180" fill="white" />
              {/* Corner squares */}
              <rect x="10" y="10" width="40" height="40" fill="black" />
              <rect x="15" y="15" width="30" height="30" fill="white" />
              <rect x="20" y="20" width="20" height="20" fill="black" />

              <rect x="130" y="10" width="40" height="40" fill="black" />
              <rect x="135" y="15" width="30" height="30" fill="white" />
              <rect x="140" y="20" width="20" height="20" fill="black" />

              <rect x="10" y="130" width="40" height="40" fill="black" />
              <rect x="15" y="135" width="30" height="30" fill="white" />
              <rect x="20" y="140" width="20" height="20" fill="black" />

              {/* Data pattern */}
              {Array.from({ length: 12 }).map((_, row) =>
                Array.from({ length: 12 }).map((_, col) => {
                  const hash =
                    (ticket.code.charCodeAt(row % ticket.code.length) *
                      (col + 1) +
                      row * 7) %
                    3;
                  if (hash === 0) return null;
                  const x = 60 + col * 8;
                  const y = 60 + row * 8;
                  if (x > 165 || y > 165) return null;
                  return (
                    <rect
                      key={`${row}-${col}`}
                      x={x}
                      y={y}
                      width="6"
                      height="6"
                      fill="black"
                    />
                  );
                })
              )}
            </svg>
          </div>
        </div>

        {/* Ticket info */}
        <div className="text-center">
          <h4 className="text-base font-bold">{ticket.title}</h4>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {ticket.date} · {ticket.time}
          </p>
          <p className="mt-0.5 text-sm text-[var(--usha-muted)]">
            {ticket.location}
          </p>
          <p className="mt-3 font-mono text-xs text-[var(--usha-gold)]">
            {ticket.code}
          </p>
        </div>
      </div>
    </div>
  );
}
