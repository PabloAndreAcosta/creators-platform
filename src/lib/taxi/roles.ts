/**
 * Volontärroller. Ett pass har en roll; reglerna (ålder, BankID, avbokning,
 * varningar, matkupong) är desamma för alla. Speglar CHECK-villkoret på
 * taxi_shifts.role — en ny roll läggs till på båda ställena.
 */
export const VOLUNTEER_ROLES = ["taxi_dancer", "door_host", "photographer", "helper"] as const;
export type VolunteerRole = (typeof VOLUNTEER_ROLES)[number];

export function parseVolunteerRole(value: unknown): VolunteerRole | null {
  return (VOLUNTEER_ROLES as readonly unknown[]).includes(value) ? (value as VolunteerRole) : null;
}
