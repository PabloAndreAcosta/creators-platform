/**
 * Volontärroller. Ett pass har en roll; reglerna (ålder, BankID, avbokning,
 * varningar, matkupong) är desamma för alla. Speglar CHECK-villkoret på
 * taxi_shifts.role — en ny roll läggs till på båda ställena.
 */
export const VOLUNTEER_ROLES = ["taxi_dancer", "instructor", "door_host", "cashier", "dj", "photographer", "helper"] as const;
export type VolunteerRole = (typeof VOLUNTEER_ROLES)[number];

export function parseVolunteerRole(value: unknown): VolunteerRole | null {
  return (VOLUNTEER_ROLES as readonly unknown[]).includes(value) ? (value as VolunteerRole) : null;
}

export const ROLE_LABEL_MAX = 40;

/** Arrangörens egna namn på passet. Tomt = rollens vanliga namn. */
export function parseRoleLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const label = value.replace(/\s+/g, " ").trim().slice(0, ROLE_LABEL_MAX).trim();
  return label || null;
}

/** Det namn passet visas med: arrangörens eget, annars rollens. */
export function shiftRoleName(
  shift: { role: VolunteerRole; role_label?: string | null },
  t: (key: string) => string,
): string {
  return shift.role_label || t(`roles.${shift.role}`);
}

/** Platser som föreslås per roll i formuläret. Taxidansare har ett eget tak (2). */
export const DEFAULT_CAPACITY: Record<VolunteerRole, number> = {
  taxi_dancer: 2,
  instructor: 2,
  door_host: 1,
  cashier: 1,
  dj: 1,
  photographer: 1,
  helper: 2,
};

/**
 * En DJ får bara ta ett obetalt pass på en practica — annars ska DJ:n
 * avlönas. Ett betalt pass (payOre > 0) är alltid tillåtet.
 */
export function volunteerRoleAllowed(role: VolunteerRole, evening: { is_practica: boolean }, payOre = 0): boolean {
  return role !== "dj" || payOre > 0 || evening.is_practica;
}
