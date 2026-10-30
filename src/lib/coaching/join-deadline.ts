/**
 * Sista dag för en instruktör att anmäla sig till ett öppet evenemang.
 *
 * Regeln (Pablos beslut 2026-10-30): senast måndag samma vecka som kvällen.
 * Arrangören behöver veta vilka som kommer i god tid för att kunna nämna dem i
 * marknadsföringen. Måndagen räknas hela dagen ut, i Stockholmstid. Ett
 * evenemang på en måndag har alltså samma dag som sista dag.
 *
 * Samma regel ligger i RLS-policyn på event_instructors, så att den inte går
 * att kringgå med ett direktanrop. Ändras den här måste policyn följa med.
 */

/** Måndagen i evenemangets vecka, ISO-datum. */
export function instructorJoinDeadline(eventDate: string): string {
  const [y, m, d] = eventDate.split("-").map(Number);
  // UTC så att sommartid inte flyttar datumet.
  const date = new Date(Date.UTC(y, m - 1, d));
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return date.toISOString().slice(0, 10);
}

/** Går det fortfarande att anmäla sig? `today` är Stockholms datum, ISO. */
export function instructorJoinOpen(eventDate: string, today: string): boolean {
  return today <= instructorJoinDeadline(eventDate);
}
