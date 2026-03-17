/**
 * iCal (.ics) generator for Usha bookings.
 * Produces a valid iCalendar feed that can be subscribed to
 * from Google Calendar, Apple Calendar, Outlook, etc.
 */

interface BookingEvent {
  id: string;
  scheduled_at: string;
  status: "pending" | "confirmed" | "completed" | "canceled";
  notes: string | null;
  listing_title: string;
  duration_minutes: number | null;
  creator_name: string | null;
  customer_name: string | null;
  is_creator: boolean;
}

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcalDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function buildEvent(booking: BookingEvent): string {
  const start = new Date(booking.scheduled_at);
  const durationMs = (booking.duration_minutes || 60) * 60 * 1000;
  const end = new Date(start.getTime() + durationMs);

  const otherParty = booking.is_creator
    ? booking.customer_name || "Kund"
    : booking.creator_name || "Kreatör";

  const summary = `${booking.listing_title} – ${otherParty}`;
  const statusLabel =
    booking.status === "confirmed"
      ? "Bekräftad"
      : booking.status === "pending"
        ? "Väntande"
        : booking.status === "completed"
          ? "Slutförd"
          : "Avbokad";

  const description = [
    `Status: ${statusLabel}`,
    booking.notes ? `Anteckningar: ${booking.notes}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  const lines = [
    "BEGIN:VEVENT",
    `UID:booking-${booking.id}@usha.se`,
    `DTSTAMP:${formatIcalDate(new Date())}`,
    `DTSTART:${formatIcalDate(start)}`,
    `DTEND:${formatIcalDate(end)}`,
    `SUMMARY:${escapeIcal(summary)}`,
    `DESCRIPTION:${escapeIcal(description)}`,
    `STATUS:${booking.status === "confirmed" ? "CONFIRMED" : booking.status === "canceled" ? "CANCELLED" : "TENTATIVE"}`,
    "END:VEVENT",
  ];

  return lines.join("\r\n");
}

export function generateIcalFeed(bookings: BookingEvent[]): string {
  const events = bookings.map(buildEvent).join("\r\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Usha//Bokningar//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Usha Bokningar",
    "X-WR-TIMEZONE:Europe/Stockholm",
    events,
    "END:VCALENDAR",
  ].join("\r\n");
}
