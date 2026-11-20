/**
 * Import av egna åtaganden från en extern kalender via dess hemliga
 * iCal-adress (ingen OAuth). Rena funktioner: adresskontroll, maskning och en
 * liten ICS-tolk. Själva hämtningen ligger i ics-fetch.ts (server).
 *
 * Bara Google Kalender släpps igenom: adressen hämtas från vår server, och en
 * fast värd gör att den inte kan användas som proxy in i något annat nät.
 */

import type { CommitmentKind } from "./commitments";

export const ALLOWED_CALENDAR_HOSTS = ["calendar.google.com"] as const;

export type CalendarUrlRejection = "invalid" | "protocol" | "host" | "credentials" | "port" | "path";

/** Godkänd extern kalenderadress? Returnerar den normaliserade adressen. */
export function validateCalendarIcsUrl(
  raw: unknown
): { ok: true; url: string } | { ok: false; reason: CalendarUrlRejection } {
  if (typeof raw !== "string") return { ok: false, reason: "invalid" };
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 2000) return { ok: false, reason: "invalid" };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "https:") return { ok: false, reason: "protocol" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  if (url.port && url.port !== "443") return { ok: false, reason: "port" };
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!(ALLOWED_CALENDAR_HOSTS as readonly string[]).includes(host)) return { ok: false, reason: "host" };
  // Googles hemliga adress: /calendar/ical/<kalender>/private-<nyckel>/basic.ics
  if (!url.pathname.startsWith("/calendar/ical/") || !url.pathname.endsWith(".ics")) {
    return { ok: false, reason: "path" };
  }
  url.hash = "";
  return { ok: true, url: url.toString() };
}

/**
 * Visningsform som inte lämnar ut nyckeln: värd plus de fyra sista tecknen i
 * den hemliga delen. Adressen är en bärarnyckel — hela kalendern för den som
 * har den — så den skrivs aldrig ut i sin helhet, varken i UI eller loggar.
 */
export function maskCalendarUrl(url: string): string {
  try {
    const u = new URL(url);
    const secret = u.pathname.split("/").find((part) => part.startsWith("private-")) ?? "";
    const tail = secret.slice(-4);
    return tail ? `${u.hostname}/…/private-••••${tail}/…` : `${u.hostname}/…`;
  } catch {
    return "…";
  }
}

// ─── ICS-tolk ───

export interface IcsEvent {
  uid: string;
  summary: string;
  location: string | null;
  /** Första dagen, YYYY-MM-DD. */
  startDate: string;
  /** Sista dagen (inklusive), YYYY-MM-DD. */
  endDate: string;
  allDay: boolean;
}

interface IcsProperty {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** RFC 5545 3.1: en rad som börjar med mellanslag eller tab fortsätter föregående. */
export function unfoldLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function parseProperty(line: string): IcsProperty | null {
  // Namn och parametrar slutar vid första kolon utanför citattecken.
  let inQuotes = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ":" && !inQuotes) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const [name, ...paramParts] = head.split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value };
}

function unescapeText(value: string): string {
  return value
    .replace(/\\[nN]/g, "\n")
    .replace(/\\([,;\\])/g, "$1")
    .trim();
}

function dateKey(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Dag och tid i Stockholm för ett UTC-ögonblick. */
function stockholmParts(date: Date): { key: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { key: dateKey(get("year"), get("month"), get("day")), minutes: get("hour") * 60 + get("minute") };
}

/**
 * DTSTART/DTEND → kalenderdag och minut på dygnet.
 * - VALUE=DATE (20261204): heldag.
 * - Med TZID eller flytande tid: värdet ÄR lokal tid i den zonen, så dagen
 *   läses direkt ur värdet. Det är dagen som spelar roll här, inte minuten.
 * - Med Z (UTC): räknas om till Stockholmstid — en händelse 23:30 UTC är nästa
 *   dag här.
 */
function parseIcsDate(prop: IcsProperty): { key: string; minutes: number; allDay: boolean } | null {
  const v = prop.value.trim();
  const dateOnly = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly || prop.params.VALUE === "DATE") {
    const m = v.match(/^(\d{4})(\d{2})(\d{2})/);
    if (!m) return null;
    return { key: dateKey(+m[1], +m[2], +m[3]), minutes: 0, allDay: true };
  }
  const dt = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/);
  if (!dt) return null;
  const [, y, mo, d, h, mi, s, z] = dt;
  if (z) {
    const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0)));
    const local = stockholmParts(date);
    return { ...local, allDay: false };
  }
  return { key: dateKey(+y, +mo, +d), minutes: +h * 60 + +mi, allDay: false };
}

/**
 * Tolkar enskilda VEVENT. Återkommande händelser (RRULE) och undantag från dem
 * (RECURRENCE-ID) hoppas över — att expandera regler hör inte hit, och ett
 * åtagande som en festival är nästan alltid en enskild händelse. Inställda
 * (STATUS:CANCELLED) och händelser utan UID eller datum hoppas också över.
 */
export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let current: IcsProperty[] | null = null;
  let depth = 0; // VALARM m.fl. inuti VEVENT

  for (const line of unfoldLines(text)) {
    if (!line) continue;
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = [];
      depth = 0;
      continue;
    }
    if (!current) continue;
    if (upper.startsWith("BEGIN:")) {
      depth++;
      continue;
    }
    if (upper.startsWith("END:") && depth > 0) {
      depth--;
      continue;
    }
    if (upper === "END:VEVENT") {
      const event = toEvent(current);
      if (event) events.push(event);
      current = null;
      continue;
    }
    if (depth > 0) continue;
    const prop = parseProperty(line);
    if (prop) current.push(prop);
  }
  return events;
}

function toEvent(props: IcsProperty[]): IcsEvent | null {
  const get = (name: string) => props.find((p) => p.name === name);
  if (get("RRULE") || get("RECURRENCE-ID")) return null;
  if (get("STATUS")?.value.trim().toUpperCase() === "CANCELLED") return null;

  const uid = get("UID")?.value.trim();
  const startProp = get("DTSTART");
  if (!uid || !startProp) return null;
  const start = parseIcsDate(startProp);
  if (!start) return null;

  let endDate = start.key;
  const endProp = get("DTEND");
  const end = endProp ? parseIcsDate(endProp) : null;
  if (end) {
    if (start.allDay) {
      // DTEND för heldag är exklusiv: 4–7 dec betyder 4, 5 och 6 dec.
      endDate = addDays(end.key, -1);
    } else {
      // Slutar exakt vid midnatt → sista dagen är dagen före.
      endDate = end.minutes === 0 && end.key > start.key ? addDays(end.key, -1) : end.key;
    }
  }
  if (endDate < start.key) endDate = start.key;

  const summary = unescapeText(get("SUMMARY")?.value ?? "");
  const location = unescapeText(get("LOCATION")?.value ?? "");
  return {
    uid,
    summary,
    location: location || null,
    startDate: start.key,
    endDate,
    allDay: start.allDay,
  };
}

/** Gissad typ: festival om titeln låter som en, annars "annat". */
export function guessCommitmentKind(title: string): CommitmentKind {
  return /festival|weekend|congress|kongress|congreso/i.test(title) ? "festival" : "annat";
}

/** Händelser som slutar idag eller senare och börjar inom horisonten. */
export function upcomingEvents(events: IcsEvent[], today: string, horizonMonths = 18): IcsEvent[] {
  const [y, m, d] = today.split("-").map(Number);
  const horizon = new Date(Date.UTC(y, m - 1 + horizonMonths, d)).toISOString().slice(0, 10);
  return events
    .filter((e) => e.endDate >= today && e.startDate <= horizon)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}
