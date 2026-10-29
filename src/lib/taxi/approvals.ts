/**
 * Ansökan per roll. Vem som helst får inte bli taxidansare eller kassa: man
 * ansöker en gång per roll hos arrangören (i serien när kvällen hör till en),
 * och först när ansökan är godkänd går passen i den rollen att boka.
 * Rena funktioner; inläsning och skrivning sker i actions.
 */

export type ApprovalStatus = "pending" | "approved" | "declined";

/** Samma avgränsning som varningarna: serien, annars arrangören. */
export function approvalScopeKey(evening: { series_id: string | null; user_id: string }): string {
  return evening.series_id ? `series:${evening.series_id}` : `host:${evening.user_id}`;
}

/** Roller personen är godkänd för, ur hens ansökningar i avgränsningen. */
export function approvedRoles(rows: readonly { role: string; status: ApprovalStatus }[]): Set<string> {
  return new Set(rows.filter((r) => r.status === "approved").map((r) => r.role));
}

/** Alla valda pass måste vara i roller personen är godkänd för. */
export function unapprovedRolesAmong(shiftRoles: readonly string[], approved: ReadonlySet<string>): string[] {
  return [...new Set(shiftRoles.filter((r) => !approved.has(r)))];
}

/** Ett eget meddelande till arrangören, kort och utan radbrytningsskräp. */
export function cleanMessage(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.replace(/\s+/g, " ").trim().slice(0, 500);
  return s || null;
}
