/**
 * Lokalens andel är lokalens villkor, inte arrangörens.
 *
 * Varje evenemang som kopplas till en lokal får lokalens standardandel
 * (venue_revenue_share_defaults) automatiskt. Tidigare kunde arrangören själv
 * sänka eller ta bort den på avräkningssidan innan första försäljningen, utan
 * att lokalen fick veta det. Pablo 2026-11-07: "Lokalens andel ska inte kunna
 * ändras hur som helst." Arrangören får höja andelen (ge lokalen mer), men
 * en sänkning eller borttagning kräver en överenskommelse med lokalen och görs
 * av admin.
 */
export type ShareChange =
  | { ok: true }
  | { ok: false; reason: "lower" | "remove" };

export function checkVenueShareChange(
  venueDefaultPercent: number | null,
  change: { kind: "save"; partnerPercent: number } | { kind: "remove" },
  isAdmin: boolean,
): ShareChange {
  if (isAdmin || venueDefaultPercent === null) return { ok: true };
  if (change.kind === "remove") return { ok: false, reason: "remove" };
  if (change.partnerPercent < venueDefaultPercent) return { ok: false, reason: "lower" };
  return { ok: true };
}
