/** Sorters pass ett uppdrag kan gälla. Speglar CHECK-villkoret på gigs.pass_type. */
export const PASS_TYPES = ["taxi_dancer", "instructor", "other"] as const;
export type PassType = (typeof PASS_TYPES)[number];

export function parsePassType(value: unknown): PassType | null {
  return (PASS_TYPES as readonly unknown[]).includes(value) ? (value as PassType) : null;
}

/**
 * Det som går att välja när ett uppdrag läggs ut. Taxidansare sköts i Taxipass
 * (volontärpass med incheckning), inte som betalda uppdrag — men värdet finns
 * kvar i PASS_TYPES så att äldre uppdrag fortfarande visas rätt.
 */
export const FORM_PASS_TYPES = ["instructor", "other"] as const satisfies readonly PassType[];
