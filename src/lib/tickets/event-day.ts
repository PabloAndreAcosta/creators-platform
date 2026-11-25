import { eveningPassesAt, type EveningLike } from "./evening";

/**
 * Gäller biljetten i dörren just nu, räknat i Stockholm?
 *
 * Skannern godkände en biljett för den 21:a på kvällen den 7:e — grön ruta,
 * "Giltig biljett". Bokningen var bekräftad och oanvänd, så statusen stämde;
 * det var datumet ingen tittade på. Jämförelsen görs i Stockholmstid, inte
 * UTC: kl. 00:30 svensk tid är det fortfarande "igår" i UTC, och en biljett
 * för en kväll som pågår efter midnatt ska inte plötsligt bli ogiltig.
 */
const STOCKHOLM_DAY = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO-datum (YYYY-MM-DD) för ett ögonblick, i Stockholmstid. */
export function stockholmDay(at: Date): string {
  return STOCKHOLM_DAY.format(at); // sv-SE ger redan YYYY-MM-DD
}

/**
 * Marginal efter kvällens slut då dörren fortfarande släpper in på biljetten.
 *
 * Kvällens slut är samma gräns som köpen och självincheckningen använder
 * (eveningPassesAt i evening.ts): midnatt, eller sluttiden om kvällen pågår
 * efter midnatt. Dörren får en timme till för kön vid stängning och för en
 * telefon vars klocka går fel. Tidigare gällde biljetten till kl. 04 natten
 * efter oavsett sluttid (beslut Pablo 2026-11-25: konsekvent med #619).
 */
export const DOOR_MARGIN_MINUTES = 60;

/** När dörren slutar släppa in på kvällens biljetter. Null utan datum. */
export function doorClosesAt(ev: EveningLike): Date | null {
  const passes = eveningPassesAt(ev);
  return passes ? new Date(passes.getTime() + DOOR_MARGIN_MINUTES * 60_000) : null;
}

/**
 * Gäller en biljett för `eventDate` i dörren vid `at`? Från eventdagens
 * början (Stockholm) till doorClosesAt. Skicka med tiderna: utan sluttid
 * räknas kvällen som slut vid midnatt, och då stänger dörren kl. 01.
 * Datumlösa poster släpps igenom som förut.
 */
export function isEventDay(
  eventDate: string | null | undefined,
  at: Date = new Date(),
  times?: Omit<EveningLike, "event_date"> | null
): boolean {
  if (!eventDate) return true; // inget datum att jämföra mot — släpp igenom som förut
  const day = eventDate.slice(0, 10);
  if (stockholmDay(at) < day) return false;
  const closes = doorClosesAt({ event_date: day, event_time: times?.event_time, event_end_time: times?.event_end_time });
  return !!closes && at < closes;
}
