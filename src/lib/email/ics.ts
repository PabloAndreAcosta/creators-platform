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
    "PRODID:-//Usch-Ja//Booking//SV",
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

interface CalendarEvent {
  uid: string;
  title: string;
  dateStr: string; // YYYY-MM-DD (event-local)
  timeStr?: string | null; // HH:MM (event-local); omit for all-day
  location?: string | null;
  description?: string | null;
}

// Multi-event subscribable calendar feed. Event date/time are stored without a
// timezone, so emit floating local times (no Z) — calendar apps render the
// intended wall-clock time.
export function buildEventsCalendarIcs(calendarName: string, events: CalendarEvent[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Usch-Ja//Calendar//SV",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(calendarName)}`,
  ];
  const stamp = fmtUtc(new Date());
  for (const e of events) {
    const d = e.dateStr.replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:${e.uid}`, `DTSTAMP:${stamp}`);
    if (e.timeStr) {
      lines.push(`DTSTART:${d}T${e.timeStr.replace(":", "")}00`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${d}`);
    }
    lines.push(`SUMMARY:${esc(e.title)}`);
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
