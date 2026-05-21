// Minimal RFC 5545 .ics builder for booking calendar invites (UTC times).

function fmtUtc(d: Date): string {
  // 2026-05-21T07:00:00.000Z -> 20260521T070000Z
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function esc(s: string): string {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

interface BookingIcsParams {
  uid: string;
  title: string;
  startsAt: Date;
  durationMinutes?: number;
  location?: string;
  description?: string;
}

export function buildBookingIcs({
  uid,
  title,
  startsAt,
  durationMinutes = 60,
  location,
  description,
}: BookingIcsParams): string {
  const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Usha//Booking//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtUtc(new Date())}`,
    `DTSTART:${fmtUtc(startsAt)}`,
    `DTEND:${fmtUtc(endsAt)}`,
    `SUMMARY:${esc(title)}`,
    description ? `DESCRIPTION:${esc(description)}` : null,
    location ? `LOCATION:${esc(location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean);
  return lines.join("\r\n");
}
