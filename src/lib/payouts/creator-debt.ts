/**
 * Kreatörsskuld: det som redan betalats ut men sedan återbetalats.
 *
 * VARFÖR DEN BEHÖVS. Avräkningen betalar ut partnerns andel dagen efter
 * kvällen. En kortbetalning kan reklameras långt senare, och ett event kan
 * ställas in efter att pengarna lämnat oss. Då har kreatören fått betalt för
 * en intäkt som inte längre finns.
 *
 * Via egenanställning är det dessutom omöjligt att backa. SAMgruppen skriver
 * det rakt ut: när lönen är utbetald är skatt och arbetsgivaravgifter redan
 * inbetalda till Skatteverket, och en utbetald lön går inte att återkalla.
 * Deras anvisning är att kvittningen sköts hos oss — en retur blir ett
 * minussaldo på kreatören som dras av nästa gång vi skickar underlag.
 *
 * Den här filen är den platsen. Utan den bokförs skulden i någons huvud, och
 * med fler än en kreatör blir det en bugg som kostar pengar.
 *
 * TECKENKONVENTION. Positivt belopp = kreatören är skyldig Usha. Negativt =
 * skulden har kvittats. Saldot är summan. Att låta båda riktningarna bo i
 * samma tabell gör historiken läsbar: man ser vad som uppstod och vad som
 * drogs av, inte bara ett tal som ändrats.
 */

export interface DebtEntry {
  amount_ore: number;
}

export interface DebtApplication {
  /** Vad kreatören ska ha för perioden, före avdrag. */
  payableOre: number;
  /** Hur mycket av skulden som kvittades den här gången. */
  deductedOre: number;
  /** Vad som är kvar att kvitta efteråt. */
  remainingDebtOre: number;
}

/**
 * Utestående skuld, i ören.
 *
 * Golvet är noll. Ett negativt saldo betyder att vi dragit av mer än som
 * fanns, och det ska inte tolkas som att Usha är skyldig kreatören pengar —
 * den riktningen hanteras av avräkningen, inte av skuldboken.
 */
export function outstandingDebtOre(entries: readonly DebtEntry[]): number {
  const summa = entries.reduce((acc, e) => acc + (Number.isFinite(e.amount_ore) ? e.amount_ore : 0), 0);
  return Math.max(0, summa);
}

/**
 * Drar av skulden från periodens underlag.
 *
 * TRE REGLER, alla nödvändiga:
 *  1. Underlaget blir aldrig negativt. Man kan inte fakturera en negativ lön,
 *     och ett negativt underlag till SAMgruppen vore en överföring åt fel håll.
 *  2. Avdraget är aldrig större än underlaget. Resten ligger kvar som skuld.
 *  3. Skulden försvinner inte för att den inte fick plats den här gången.
 */
export function applyDebt(input: { grossOre: number; debtOre: number }): DebtApplication {
  const gross = Math.max(0, Math.round(input.grossOre || 0));
  const debt = Math.max(0, Math.round(input.debtOre || 0));

  const deducted = Math.min(gross, debt);
  return {
    payableOre: gross - deducted,
    deductedOre: deducted,
    remainingDebtOre: debt - deducted,
  };
}

/**
 * Kreatörens andel av en återbetalning — det belopp som ska bli skuld.
 *
 * Räknas på samma sätt som andelen räknades när pengarna betalades ut, annars
 * blir kvittningen fel åt något håll. Momsen hör till Usha som säljare och
 * ingår därför inte i kreatörens andel.
 */
export function debtFromRefund(input: {
  refundedOre: number;
  vatRate: number;
  partnerPercent: number;
}): number {
  const refunded = Math.max(0, Math.round(input.refundedOre || 0));
  if (refunded === 0) return 0;
  if (input.vatRate < 0 || input.vatRate >= 1) throw new Error("vatRate anges som decimal, t.ex. 0.25");
  if (input.partnerPercent < 0 || input.partnerPercent > 100) {
    throw new Error("partnerPercent måste ligga mellan 0 och 100");
  }

  const vat = Math.round(refunded * (input.vatRate / (1 + input.vatRate)));
  const basis = refunded - vat;
  // Golvet följer splitEventRevenue: partnern får den avrundade nedre delen,
  // så att kvittningen aldrig blir större än utbetalningen var.
  return Math.floor((basis * input.partnerPercent) / 100);
}
