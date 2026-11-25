/**
 * Lokalens svar på en kopplingsförfrågan, som ett tillstånd.
 *
 * Tre lägen, inte två: "nej" och "inte svarat" såg likadana ut så länge bara
 * venue_confirmed_at fanns, och arrangören väntade då på ett ja som aldrig
 * skulle komma.
 */
export type VenueResponseState = "none" | "pending" | "confirmed" | "declined";

export function venueResponseState(row: {
  venue_profile_id?: string | null;
  venue_confirmed_at?: string | null;
  venue_declined_at?: string | null;
}): VenueResponseState {
  if (!row.venue_profile_id) return "none";
  if (row.venue_confirmed_at) return "confirmed";
  if (row.venue_declined_at) return "declined";
  return "pending";
}

/**
 * Ska arrangören få besked? Bara när svaret faktiskt ändrade något — ett
 * dubbelklick på "Godkänn" ska inte ge två mejl.
 */
export function shouldNotifyOrganiser(before: VenueResponseState, confirm: boolean): boolean {
  return confirm ? before !== "confirmed" : before !== "declined";
}
