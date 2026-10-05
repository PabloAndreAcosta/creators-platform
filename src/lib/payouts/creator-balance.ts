import { outstandingDebtOre, type DebtEntry } from "./creator-debt";

/**
 * Vad Usha är skyldig en kreatör — och vad hen själv kan se.
 *
 * VARFÖR DEN BEHÖVS. Ersättningen till en medkreatör fanns bara i Pablos
 * huvud. Gizem undervisade på The Lab den 1 oktober, hennes andel bestämdes
 * till 368 kr, och det enda stället siffran fanns var i ett chattmeddelande.
 * Hon kunde varken se vad hon tjänat, vad som betalats ut eller vad som
 * återstår.
 *
 * Det duger inte när ersättningen är liten. Då ÄR öppenheten en del av
 * betalningen — se [[feedback-medkreator-insyn]]. Och det duger inte när
 * utbetalningen dröjer, vilket den gör så fort den går via egenanställning.
 *
 * BELOPPEN ÄR FÖRE SKATT OCH SOCIALA AVGIFTER. Det är vad Usha är skyldig,
 * inte vad som landar på kreatörens konto. Vad som blir kvar efter avdrag
 * beror på vilken väg hen väljer — egenanställning, eget bolag eller faktura
 * — och den kedjan räknas inte här. Att visa ett nettobelopp vore att låtsas
 * veta något vi inte vet.
 */

export interface EarningEntry {
  amount_ore: number;
  paid_at: string | null;
}

export interface CreatorBalance {
  /** Allt som tjänats in, betalt eller ej. */
  earnedOre: number;
  /** Det som redan betalats ut. */
  paidOre: number;
  /** Intjänat men ännu inte utbetalt. */
  unpaidOre: number;
  /** Skuld till Usha, t.ex. en återbetalning efter utbetald andel. */
  debtOre: number;
  /**
   * Vad som faktiskt skulle betalas ut i dag: obetalt minus skuld, aldrig
   * under noll. En negativ utbetalning finns inte — kvarvarande skuld ligger
   * kvar i debtOre och dras av nästa gång.
   */
  payableOre: number;
}

export function creatorBalance(
  earnings: readonly EarningEntry[],
  debts: readonly DebtEntry[] = []
): CreatorBalance {
  let earnedOre = 0;
  let paidOre = 0;
  for (const e of earnings) {
    const belopp = Number.isFinite(e.amount_ore) ? Math.round(e.amount_ore) : 0;
    earnedOre += belopp;
    if (e.paid_at) paidOre += belopp;
  }
  const unpaidOre = earnedOre - paidOre;
  const debtOre = outstandingDebtOre(debts);
  return {
    earnedOre,
    paidOre,
    unpaidOre,
    debtOre,
    payableOre: Math.max(0, unpaidOre - debtOre),
  };
}
