/** Sorters pass ett uppdrag kan gälla. Speglar CHECK-villkoret på gigs.pass_type. */
export const PASS_TYPES = ["taxi_dancer", "instructor", "other"] as const;
export type PassType = (typeof PASS_TYPES)[number];

export function parsePassType(value: unknown): PassType | null {
  return (PASS_TYPES as readonly unknown[]).includes(value) ? (value as PassType) : null;
}
