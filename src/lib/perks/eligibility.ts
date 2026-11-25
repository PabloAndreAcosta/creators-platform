/**
 * Vem som får ta del av Usha-förmånerna.
 *
 * Beslut Pablo 2026-11-25: en Usha-kund är, tills vidare, alla som har ett
 * konto och är inloggade. Senare, när Usha tar betalt för ett abonnemang där
 * förmånerna ingår, ska regeln bli "har ett aktivt abonnemang".
 *
 * Regeln bor HÄR och ingen annanstans. Sidorna frågar bara den här
 * funktionen, så bytet till abonnemang är en ändring på ett ställe (plus
 * testet) — inte en jakt genom appen.
 */

/** Det regeln behöver veta om kontot. Fylls på när regeln skärps. */
export interface PerkUser {
  id: string;
}

export function isPerkEligible(user: PerkUser | null | undefined): boolean {
  return typeof user?.id === "string" && user.id.length > 0;
}
