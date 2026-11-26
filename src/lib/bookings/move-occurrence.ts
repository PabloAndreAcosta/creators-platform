/**
 * Att flytta en biljett till en annan kväll i samma serie.
 *
 * Bakgrunden: ombokningsknappen i bokningslistan skrev bara `scheduled_at`.
 * Dörren läser `listings.event_date`, inte `scheduled_at`, så en "ombokad"
 * biljett såg flyttad ut i listan och nekades ändå i dörren — tyst, och först
 * när gästen stod där. Knappen var byggd för tjänstebokningar och visades för
 * allt.
 *
 * En biljett flyttas genom att peka om `listing_id` till en annan kväll i
 * serien, och `ticket_type_id` till den kväll ens motsvarande biljettyp.
 */

import { inomFonster } from "@/lib/settlements/supplement";
import { stockholmLocalToUtcISO } from "@/lib/time";

export interface OccurrenceLike {
  id: string;
  event_date: string | null;
  series_id?: string | null;
  is_active?: boolean | null;
  is_public?: boolean | null;
}

export interface TicketTypeLike {
  id: string;
  name: string;
  capacity: number | null;
  tickets_sold: number | null;
}

/** Är det här en biljett till ett daterat evenemang, eller en tjänstebokning? */
export function isDatedEvent(listing: { event_date?: string | null } | null): boolean {
  return !!listing?.event_date;
}

export type MoveBlock =
  | "not_same_series"
  | "not_bookable"
  | "in_the_past"
  | "same_occurrence"
  | "no_matching_type"
  | "sold_out"
  | "source_settled"
  | "target_settled";

/**
 * Får bokningen flyttas hit? Returnerar null när allt är i sin ordning,
 * annars skälet — anroparen översätter det till ett meddelande.
 *
 * `today` är Stockholmsdatum ("YYYY-MM-DD"); kvällen som pågår i dag räknas
 * som framtid, för en gäst kan omboka samma dag.
 */
export function blockingReason(args: {
  from: OccurrenceLike;
  to: OccurrenceLike;
  today: string;
  /** Biljettypens namn på den ursprungliga kvällen, om bokningen har en. */
  ticketTypeName: string | null;
  /** Biljettyper på målkvällen. */
  targetTypes: readonly TicketTypeLike[];
  quantity: number;
  /** Har kvällen bokningen ligger på redan betalats ut till partnern? */
  fromSettled?: boolean;
  /** Har målkvällen redan betalats ut? */
  toSettled?: boolean;
  /**
   * Flyttar arrangören (inte gästen)? Arrangören får lägga en biljett på en
   * kväll som redan varit — gästen köpte fel datum efter kvällen — så länge
   * kvällen ligger inom kompletteringsfönstret, så att partnerns andel kommer
   * fram. Gästen själv kan bara välja kommande kvällar.
   */
  byArranger?: boolean;
}): MoveBlock | null {
  const { from, to, today, ticketTypeName, targetTypes, quantity, fromSettled, toSettled, byArranger } = args;

  if (to.id === from.id) return "same_occurrence";

  // Avräkningen räknar en kvälls intäkt genom att fråga bookings på
  // listing_id, så pengarna följer med en flytt av sig själva.
  //
  // En utbetald kväll räknas inte om av run-payouts (den hoppar över status
  // "paid"), men kompletteringen (run-supplements) räknar om den i
  // KOMPLETTERING_FONSTER_DAGAR och för över mellanskillnaden. Därför:
  //   - flytt FRÅN en utbetald kväll = partnern har redan fått sin andel av
  //     biljetten och får den igen när målkvällen räknas. Kompletteringen
  //     rättar aldrig en överbetalning automatiskt. Dubbelbetalning — neka.
  //   - flytt TILL en utbetald kväll = kvällen får en biljett till, och
  //     kompletteringen betalar partnerns andel av den. Tillåtet så länge
  //     kvällen ligger inom fönstret; utanför det kommer andelen aldrig fram.
  if (fromSettled) return "source_settled";
  if (toSettled && !(to.event_date && inomFonster(to.event_date, today))) return "target_settled";
  // Flytt sker inom en serie. Utan den gränsen vore det inte en ombokning utan
  // ett byte av vara: ett annat pris, en annan lokal, kanske en annan arrangör.
  if (!from.series_id || !to.series_id || from.series_id !== to.series_id) return "not_same_series";
  if (to.is_active === false || to.is_public === false) return "not_bookable";
  if (!to.event_date) return "in_the_past";
  if (to.event_date < today && !(byArranger && inomFonster(to.event_date, today))) return "in_the_past";

  if (ticketTypeName) {
    const match = matchTicketType(ticketTypeName, targetTypes);
    if (!match) return "no_matching_type";
    if (!hasRoom(match, quantity)) return "sold_out";
  }
  return null;
}

/**
 * Motsvarande biljettyp på målkvällen, matchad på namn.
 *
 * Serierna skapar identiskt namngivna typer per kväll ("Practica 17–19"), men
 * med nya id:n — samma sak som gjorde dörr-QR:erna fel i #404. Namnet är det
 * enda som bär över, så det är det vi matchar på.
 */
export function matchTicketType(
  name: string,
  types: readonly TicketTypeLike[]
): TicketTypeLike | null {
  const norm = (s: string) => s.trim().toLowerCase();
  return types.find((t) => norm(t.name) === norm(name)) ?? null;
}

/** Finns det plats kvar? Utan tak är svaret alltid ja. */
export function hasRoom(type: TicketTypeLike, quantity: number): boolean {
  if (type.capacity == null) return true;
  return (type.tickets_sold ?? 0) + quantity <= type.capacity;
}

/**
 * Fälten en biljett får när den flyttas till en annan kväll.
 *
 * `scheduled_at` MÅSTE följa med. Dörren läser `listing_id`, men påminnelserna
 * (dagen före och "snart"), bekräftelsemejlet, kalendersynken, "Var du där?"
 * och statistiken läser `scheduled_at`. Flytten skrev förut bara listing_id,
 * så en biljett flyttad från 26 nov till 19 nov fick påminnelser om 26 nov —
 * en kväll den inte längre gällde (bokning 970cbd73, nov 2026).
 *
 * Påminnelsestämplarna nollas: de gällde den gamla kvällen, och utan nollning
 * får gästen aldrig någon påminnelse om den nya. Ligger den nya kvällen bakåt
 * i tiden plockar cron-jobben ändå aldrig upp den (de tittar bara framåt).
 */
export function movedBookingFields(
  target: { id: string; event_date: string; event_time?: string | null },
  newTypeId: string | null
): {
  listing_id: string;
  ticket_type_id?: string;
  scheduled_at?: string;
  reminder_sent_at: null;
  reminder_soon_sent_at: null;
} {
  const time = (target.event_time ?? "").slice(0, 5) || "00:00";
  const scheduledAt = stockholmLocalToUtcISO(`${target.event_date}T${time}`);
  return {
    listing_id: target.id,
    ...(newTypeId ? { ticket_type_id: newTypeId } : {}),
    ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
    reminder_sent_at: null,
    reminder_soon_sent_at: null,
  };
}
