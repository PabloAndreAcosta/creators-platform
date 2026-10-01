/**
 * Dörrlänkar: en QR-kod som aldrig behöver bytas ut.
 *
 * PROBLEMET DEN LÖSER. Varje kväll är ett eget listing med egen slug OCH egna
 * biljettyper med nya id:n. En QR-kod som pekar på /event/<slug>?tt=<id> är
 * därför färsk i exakt en vecka. Dörrskärmen för The Lab pekade på måndagen
 * den 21 september; gästen som skannade i oktober möttes av "Det här eventet
 * har varit" och kunde inte köpa något alls.
 *
 * Lösningen är att låta adressen peka på SERIEN och PLATSEN i kvällen, inte på
 * kvällen. /dorr/the-lab-torsdag/workshop slår upp nästa kväll i serien och
 * dess workshopbiljett, och skickar gästen rakt till den. Samma kod fungerar
 * nästa vecka, nästa termin, och efter ett prisbyte.
 *
 * VARFÖR sort_order OCH INTE NAMN. Namnen bär tider — "Workshop 19–20" — och
 * ändras när schemat flyttas. sort_order är kvällens ordning: practica,
 * workshop, social, allt. Den överlever en namnändring. Men ett namn är
 * läsbart i en adress, så båda går: siffra matchar sort_order, ord matchar
 * namnets början.
 */

export interface DoorTicketType {
  id: string;
  name: string;
  sort_order: number | null;
  capacity: number | null;
  tickets_sold: number;
}

export interface DoorOccurrence {
  slug: string;
  title: string;
  event_date: string | null;
}

/** Slutsåld biljettyp ska inte väljas åt någon — då ser det ut som ett fel. */
function soldOut(t: DoorTicketType): boolean {
  return t.capacity != null && t.tickets_sold >= t.capacity;
}

/**
 * En inställd kväll får aldrig säljas i dörren.
 *
 * Inställt markeras i titeln ("INSTÄLLT: The Lab …") — det finns ingen egen
 * kolumn. Att läsa titeln är fult, men alternativet är att sälja en biljett
 * till en kväll som inte blir av, och det är fulare.
 */
export function isCancelled(title: string): boolean {
  return /^\s*(INSTÄLLT|INSTALLT|CANCELLED)\b/i.test(title);
}

/**
 * Kvällen en dörrlänk ska leda till: den första som inte varit och inte är
 * inställd. Listan förutsätts sorterad på datum stigande.
 *
 * `idag` jämförs som datum, inte tidpunkt. En kväll som pågår 17–23 ska träffas
 * även kl. 22 — annars slutar dörrförsäljningen fungera mitt under kvällen,
 * vilket är precis när den används.
 */
export function pickOccurrence(
  occurrences: readonly DoorOccurrence[],
  idag: string
): DoorOccurrence | null {
  for (const o of occurrences) {
    if (!o.event_date) continue;
    if (o.event_date.slice(0, 10) < idag) continue;
    if (isCancelled(o.title)) continue;
    return o;
  }
  return null;
}

/**
 * Biljettypen en dörrlänk pekar ut.
 *
 * `plats` är antingen en siffra (sort_order) eller början på namnet. Hittas
 * ingen match returneras null, och anroparen skickar gästen till kvällen utan
 * förval — hellre rätt kväll med fel förval än ett 404 i dörren.
 */
export function pickTicketType(
  types: readonly DoorTicketType[],
  plats: string
): DoorTicketType | null {
  const köpbara = types.filter((t) => !soldOut(t));
  if (köpbara.length === 0) return null;

  const siffra = /^\d+$/.test(plats.trim()) ? Number(plats.trim()) : null;
  if (siffra !== null) {
    return köpbara.find((t) => (t.sort_order ?? 0) === siffra) ?? null;
  }

  const sökt = normalisera(plats);
  if (!sökt) return null;
  return köpbara.find((t) => normalisera(t.name).startsWith(sökt)) ?? null;
}

/** Gemener, utan diakriter och skiljetecken — "Allt: practica…" → "alltpractica". */
function normalisera(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Adressen gästen ska skickas till. `#biljetter` är ankaret till biljettrutan
 * på eventsidan, så telefonen landar på köpet i stället för högst upp på en
 * sida gästen då måste scrolla igenom.
 */
export function doorTarget(slug: string, ticketTypeId: string | null): string {
  const bas = `/event/${slug}`;
  return ticketTypeId ? `${bas}?tt=${ticketTypeId}#biljetter` : `${bas}#biljetter`;
}
