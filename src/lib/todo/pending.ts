/**
 * Sådant som väntar på att någon gör något.
 *
 * En lokal fick åtta förfrågningar om att hålla evenemang hos sig och märkte
 * ingenting: inget mejl, ingen notis, och sidan låg bakom en meny hon inte
 * visste fanns. Hon fick reda på det för att arrangören skrev på Slack.
 *
 * Det är inte ett menyproblem. Det som väntar på beslut ska komma till
 * användaren, inte ligga och vänta på att bli hittat. Den här modulen räknar
 * ut vad som väntar; startsidan visar det överst.
 *
 * Gränsdragning mot kom-igång-checklistan: checklistan är sådant du ställer in
 * en gång om dig själv. Det här är sådant andra har skickat till dig och som
 * inte händer förrän du svarar. Samma sak på båda ställena vore brus.
 */

export type TodoKey = "venueRequests" | "awaitingVenue";

export interface TodoItem {
  key: TodoKey;
  /** Hur många som väntar. Alltid minst 1 — noll ger ingen post alls. */
  count: number;
  href: string;
}

export interface TodoInput {
  /** Förfrågningar till lokaler jag ansvarar för, obesvarade. */
  venueRequestsPending?: number | null;
  /** Mina egna evenemang som väntar på en lokals ja. */
  listingsAwaitingVenue?: number | null;
}

function antal(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/**
 * Ordningen är avsiktlig: det som väntar på MITT svar först, det som väntar på
 * någon annans sist. Jag kan bara agera på det första.
 */
export function pendingTodos(input: TodoInput): TodoItem[] {
  const items: TodoItem[] = [];

  const requests = antal(input.venueRequestsPending);
  if (requests > 0) {
    items.push({ key: "venueRequests", count: requests, href: "/app/venue-requests" });
  }

  const awaiting = antal(input.listingsAwaitingVenue);
  if (awaiting > 0) {
    items.push({ key: "awaitingVenue", count: awaiting, href: "/app/events" });
  }

  return items;
}
