"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar, MapPin, Clock, QrCode, X, Ticket } from "lucide-react";
import { useToast } from "@/components/ui/toaster";
import QRCode from "qrcode";

interface TicketData {
  id: string;
  code: string;
  title: string;
  date: string;
  time: string;
  location: string;
  status: "active" | "used" | "upcoming";
  type: string;
  amountPaid: number | null;
  bookingType: string;
}

interface BookingData {
  id: string;
  scheduled_at: string;
  status: string;
  notes: string | null;
  amount_paid: number | null;
  booking_type: string | null;
  listings: { title: string; category: string; image_url?: string | null; event_date?: string | null; event_time?: string | null; event_location?: string | null } | null;
}

interface TicketsContentProps {
  bookings: BookingData[];
}

function bookingToTicket(booking: BookingData): TicketData {
  const scheduledDate = new Date(booking.scheduled_at);
  const now = new Date();
  const isPast = scheduledDate < now;
  const isCompleted = booking.status === "completed" || booking.status === "canceled";

  let status: "active" | "used" | "upcoming";
  if (isCompleted || isPast) {
    status = "used";
  } else {
    const hoursUntil = (scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    status = hoursUntil <= 24 ? "active" : "upcoming";
  }

  // Prefer event_date/event_time from listing over scheduled_at
  const listing = booking.listings;
  let displayDate: string;
  let displayTime: string;

  if (listing?.event_date) {
    displayDate = new Date(listing.event_date + "T00:00").toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } else {
    displayDate = scheduledDate.toLocaleDateString("sv-SE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  if (listing?.event_time) {
    displayTime = listing.event_time.slice(0, 5);
  } else {
    displayTime = scheduledDate.toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const displayLocation = listing?.event_location || booking.notes || "-";

  return {
    id: booking.id,
    code: `USH-${booking.id.slice(0, 8).toUpperCase()}`,
    title: listing?.title || "Bokning",
    date: displayDate,
    time: displayTime,
    location: displayLocation,
    status,
    type: listing?.category || "Bokning",
    amountPaid: booking.amount_paid,
    bookingType: booking.booking_type || "manual",
  };
}

export function TicketsContent({ bookings }: TicketsContentProps) {
  const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Biljett köpt!", "Din biljett finns nu här nedanför.");
      // Clean up URL
      window.history.replaceState({}, "", "/app/tickets");
    }
  }, [searchParams, toast]);

  const tickets = bookings.map(bookingToTicket);
  const activeTickets = tickets.filter(
    (t) => t.status === "active" || t.status === "upcoming"
  );
  const usedTickets = tickets.filter((t) => t.status === "used");

  if (tickets.length === 0) {
    return (
      <div className="px-4 py-6 space-y-8">
        <h1 className="text-2xl font-bold">Mina Biljetter</h1>
        <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] py-16">
          <Ticket size={40} className="mb-4 text-[var(--usha-muted)]" />
          <p className="text-base font-medium text-[var(--usha-muted)]">
            Du har inga biljetter ännu
          </p>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            Boka ett evenemang för att få din första biljett
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 space-y-8">
      <h1 className="text-2xl font-bold">Mina Biljetter</h1>

      {/* Active Tickets */}
      {activeTickets.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
            Aktiva Biljetter
          </h2>
          <div className="space-y-4 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
            {activeTickets.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onShowQR={() => setSelectedTicket(ticket)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Used Tickets */}
      {usedTickets.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
            Använda Biljetter
          </h2>
          <div className="space-y-4 opacity-60 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
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
          {ticket.location !== "-" && (
            <div className="flex items-center gap-2">
              <MapPin size={12} />
              <span>{ticket.location}</span>
            </div>
          )}
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
          {ticket.amountPaid != null && ticket.bookingType === "ticket" && (
            <p className="mt-0.5 text-xs font-semibold text-[var(--usha-gold)]">
              Betalt: {(ticket.amountPaid / 100).toFixed(0)} kr
            </p>
          )}
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
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    const verificationUrl = `${window.location.origin}/api/tickets/verify?code=${ticket.code}&id=${ticket.id}`;
    QRCode.toDataURL(verificationUrl, {
      width: 200,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [ticket.code, ticket.id]);

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

        {/* QR Code */}
        <div className="mb-6 flex items-center justify-center">
          <div className="rounded-2xl border-2 border-[var(--usha-gold)]/30 bg-white p-4">
            {qrDataUrl ? (
              <img src={qrDataUrl} alt={`QR-kod för ${ticket.code}`} width={200} height={200} />
            ) : (
              <div className="flex h-[200px] w-[200px] items-center justify-center">
                <QrCode size={48} className="animate-pulse text-gray-300" />
              </div>
            )}
          </div>
        </div>

        {/* Ticket info */}
        <div className="text-center">
          <h4 className="text-base font-bold">{ticket.title}</h4>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {ticket.date} · {ticket.time}
          </p>
          {ticket.location !== "-" && (
            <p className="mt-0.5 text-sm text-[var(--usha-muted)]">
              {ticket.location}
            </p>
          )}
          <p className="mt-3 font-mono text-xs text-[var(--usha-gold)]">
            {ticket.code}
          </p>
        </div>
      </div>
    </div>
  );
}
