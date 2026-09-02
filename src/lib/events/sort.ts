/**
 * Ordning i arrangörens egen evenemangslista.
 *
 * Listan sorterades på skapandetid. En serie skapas i en klump med nästan
 * identiska tidsstämplar, så åtta måndagar hamnade i praktiken i slumpmässig
 * ordning — 5 oktober först, 7 september sist.
 *
 * Rätt ordning är den arrangören tänker i: nästa kväll överst. Passerade
 * evenemang ligger kvar som bibliotek, men efter de kommande och med den
 * senaste först — det man vill titta tillbaka på är gårdagen, inte i fjol.
 */

export interface SortableEvent {
  event_date?: string | null;
  created_at?: string | null;
}

/**
 * Sorterar: kommande i stigande ordning, sedan passerade i fallande, och sist
 * det som saknar datum (tjänster och utkast) med det senast skapade först.
 */
export function sortEventsForOwner<T extends SortableEvent>(
  events: readonly T[],
  today: string
): T[] {
  const kommande: T[] = [];
  const passerade: T[] = [];
  const utanDatum: T[] = [];

  for (const e of events) {
    const d = e.event_date;
    if (!d) utanDatum.push(e);
    else if (d >= today) kommande.push(e);
    else passerade.push(e);
  }

  kommande.sort((a, b) => (a.event_date! < b.event_date! ? -1 : a.event_date! > b.event_date! ? 1 : 0));
  passerade.sort((a, b) => (a.event_date! > b.event_date! ? -1 : a.event_date! < b.event_date! ? 1 : 0));
  utanDatum.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));

  return [...kommande, ...passerade, ...utanDatum];
}

/** Dagens datum i Stockholm som "YYYY-MM-DD". Evenemangsdatum är lokala datum. */
export function todayInStockholm(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
