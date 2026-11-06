"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Ticket } from "lucide-react";

/**
 * Väntar in biljetten när kvittosidan hann före webhooken. Frågar var annan
 * sekund i upp till en minut; sedan ger vi upp och hänvisar till mejlet, som
 * alltid kommer oavsett.
 */
export function AwaitTicket({ sessionId }: { sessionId: string }) {
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let active = true;
    let tries = 0;
    const tick = async () => {
      if (!active) return;
      tries += 1;
      try {
        const res = await fetch(`/api/tickets/by-session?session_id=${encodeURIComponent(sessionId)}`);
        if (res.ok) {
          const data = await res.json();
          if (active && data.id) {
            setBookingId(data.id);
            return;
          }
        }
      } catch {
        // nätet hickade — försök igen
      }
      if (tries >= 30) {
        if (active) setGaveUp(true);
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
    return () => {
      active = false;
    };
  }, [sessionId]);

  if (bookingId) return <TicketLink bookingId={bookingId} />;
  if (gaveUp) {
    return (
      <p className="mb-6 max-w-md text-sm text-[var(--usha-muted)]">
        Biljetten dröjer lite — den ligger i mejlet inom några minuter.
      </p>
    );
  }
  return (
    <div className="mb-6 flex items-center gap-2 text-sm text-[var(--usha-muted)]">
      <Loader2 size={16} className="animate-spin" />
      Hämtar din biljett…
    </div>
  );
}

export function TicketLink({ bookingId }: { bookingId: string }) {
  return (
    <Link
      href={`/biljett/${bookingId}`}
      className="mb-6 inline-flex items-center gap-2 rounded-xl bg-[var(--usha-gold)] px-6 py-3.5 text-base font-semibold text-black transition hover:opacity-90"
    >
      <Ticket size={18} />
      Visa min biljett
    </Link>
  );
}
