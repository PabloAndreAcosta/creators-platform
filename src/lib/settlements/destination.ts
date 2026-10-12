/**
 * Mottagarkontot ur ett Stripe-överföringssvar.
 *
 * Stripe returnerar `destination` antingen som ett konto-id ("acct_…") eller
 * som ett expanderat objekt, beroende på anrop och API-version. Att läsa fel
 * variant ger `[object Object]` i databasen, vilket är värre än null — det ser
 * ut som ett svar men är det inte.
 *
 * Varför vi sparar det alls: Bacchi frågade 8 oktober var 1 980 kr tog vägen
 * och vi kunde inte svara. Mottagaren lästes ur profilen vid överföringen och
 * kastades bort. Byter kontot på profilen finns spåret bara hos Stripe.
 */
export function destinationAccountId(
  destination: string | { id?: string | null } | null | undefined
): string | null {
  if (typeof destination === "string") return destination || null;
  if (destination && typeof destination === "object") return destination.id || null;
  return null;
}
