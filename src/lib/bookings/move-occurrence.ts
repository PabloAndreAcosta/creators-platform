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
}): MoveBlock | null {
  const { from, to, today, ticketTypeName, targetTypes, quantity, fromSettled, toSettled } = args;

  if (to.id === from.id) return "same_occurrence";

  // Avräkningen räknar en kvälls intäkt genom att fråga bookings på
  // listing_id, så pengarna följer med en flytt av sig själva — så länge
  // ingen av kvällarna är stängd.
  //
  // En utbetald kväll räknas aldrig om (run-payouts hoppar över status
  // "paid"). Därför:
  //   - flytt FRÅN en utbetald kväll = partnern har redan fått sin andel av
  //     biljetten, och får den igen när målkvällen räknas. Dubbelbetalning.
  //   - flytt TILL en utbetald kväll = biljetten landar i en stängd bok och
  //     partnern får aldrig sin andel.
  // Båda tyst, båda i riktiga pengar. Återbetala och sälj om i stället.
  if (fromSettled) return "source_settled";
  if (toSettled) return "target_settled";
  // Flytt sker inom en serie. Utan den gränsen vore det inte en ombokning utan
  // ett byte av vara: ett annat pris, en annan lokal, kanske en annan arrangör.
  if (!from.series_id || !to.series_id || from.series_id !== to.series_id) return "not_same_series";
  if (to.is_active === false || to.is_public === false) return "not_bookable";
  if (!to.event_date || to.event_date < today) return "in_the_past";

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
