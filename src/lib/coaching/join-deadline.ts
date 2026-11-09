/**
 * Sista dag för en instruktör att anmäla sig till ett öppet evenemang.
 *
 * Regeln: senast samma dag som kvällen, i Stockholmstid.
 *
 * Fram till 2026-11-09 var gränsen måndag samma vecka, för att arrangören
 * skulle hinna nämna instruktörerna i marknadsföringen (#490). Pablo tog bort
 * den: en instruktör som bestämmer sig samma vecka ska inte stängas ute, och
 * just nu väger det tyngre att få in instruktörer än att hinna marknadsföra dem.
 *
 * Samma regel ligger i RLS-policyn på event_instructors, så att den inte går
 * att kringgå med ett direktanrop. Ändras den här måste policyn följa med.
 */

/** Sista anmälningsdag, ISO-datum: evenemangets egen dag. */
export function instructorJoinDeadline(eventDate: string): string {
  return eventDate.slice(0, 10);
}

/** Går det fortfarande att anmäla sig? `today` är Stockholms datum, ISO. */
export function instructorJoinOpen(eventDate: string, today: string): boolean {
  return today <= instructorJoinDeadline(eventDate);
}
