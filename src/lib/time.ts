// Tidszons-helpers för Europe/Stockholm. <input type="datetime-local"> ger
// wall-clock utan zon ("2026-07-11T11:00"); vi tolkar den som svensk tid och
// lagrar UTC. Korrekt över DST (offset beräknas vid själva tidpunkten).

const TZ = "Europe/Stockholm";

/** Stockholm-väggklocka ("YYYY-MM-DDTHH:mm") → UTC ISO-sträng (eller null). */
export function stockholmLocalToUtcISO(local: string | null | undefined): string | null {
  if (!local) return null;
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as unknown as number[];

  // Tolka väggklockan som om den vore UTC, mät sedan Stockholms offset där.
  const base = Date.UTC(y, mo - 1, d, h, mi);
  const offset = stockholmOffsetMs(new Date(base));
  return new Date(base - offset).toISOString();
}

/** UTC ISO-sträng → Stockholm-väggklocka ("YYYY-MM-DDTHH:mm") för prefill. */
export function utcToStockholmLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = stockholmParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function stockholmParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  // en-CA ger 24h; "24" vid midnatt normaliseras till "00".
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return { year: parts.year, month: parts.month, day: parts.day, hour, minute: parts.minute, second: parts.second };
}

/** Hur många ms Stockholm ligger före UTC vid en given tidpunkt. */
function stockholmOffsetMs(date: Date): number {
  const p = stockholmParts(date);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUTC - date.getTime();
}
