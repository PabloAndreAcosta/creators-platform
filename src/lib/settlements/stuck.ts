/**
 * Avräkningar som fastnat.
 *
 * VARFÖR DEN BEHÖVS. En överföring som nekas med `balance_insufficient`
 * betraktas som uppskjuten: raden lämnas som "pending" och tas om nästa körning
 * utan att larma. Tanken är rimlig — pengar från ett kortköp blir tillgängliga
 * i Stripe med någon dags fördröjning, och ett larm för något som löser sig av
 * sig självt lär man sig att ignorera.
 *
 * Men antagandet håller bara om saldot faktiskt blir tillgängligt. Står Stripe
 * på automatiska utbetalningar sveps saldot till banken löpande, och då finns
 * det aldrig något att föra över när jobbet kör. Raden ligger kvar som
 * "pending" i evighet, partnern får inte sina pengar, och ingen får veta —
 * eftersom tystnad är exakt vad den uppskjutna vägen är byggd för.
 *
 * Det hände 2026-10-01: The Lab den 1 oktober, 736 kr till Bacchi Syre,
 * nekad med precis den texten. Felet upptäcktes för att någon råkade läsa
 * tabellen, inte för att systemet sa ifrån.
 *
 * Den här filen gör skillnad på "uppskjuten i natt" och "fastnat". Det första
 * är normalt. Det andra är obetalda pengar till någon som utfört ett arbete,
 * och ska väcka folk.
 */

export interface PayoutRow {
  listing_id: string;
  status: string;
  amount_ore: number;
  created_at: string;
  error: string | null;
}

export interface StuckPayout {
  listingId: string;
  amountOre: number;
  dagar: number;
  error: string | null;
}

/**
 * Hur länge en uppskjuten rad får ligga innan den räknas som fastnad.
 *
 * Utbetalningen sker dagen efter kvällen (payout_delay_days = 1), och
 * kortpengar blir tillgängliga inom ett par dygn. Två dygns fördröjning är
 * alltså inom det normala; tre är det inte.
 */
export const FASTNAD_EFTER_DAGAR = 2;

/** Hela dygn mellan två tidpunkter, golvat. */
function dygnMellan(fran: string, till: Date): number {
  const start = new Date(fran).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.floor((till.getTime() - start) / 86_400_000);
}

/**
 * Rader som väntat för länge.
 *
 * `failed` tas med oavsett ålder: det är ett riktigt fel som redan en gång
 * bedömts som icke-övergående, och det ska inte behöva mogna i två dygn innan
 * någon får veta.
 */
export function stuckPayouts(
  rows: readonly PayoutRow[],
  now: Date = new Date(),
  maxDagar: number = FASTNAD_EFTER_DAGAR
): StuckPayout[] {
  const ut: StuckPayout[] = [];
  for (const r of rows) {
    if (r.status === "paid" || r.status === "dry_run") continue;
    const dagar = dygnMellan(r.created_at, now);
    if (r.status === "pending" && dagar <= maxDagar) continue;
    ut.push({ listingId: r.listing_id, amountOre: r.amount_ore, dagar, error: r.error });
  }
  return ut.sort((a, b) => b.dagar - a.dagar);
}

/**
 * Den troliga orsaken i klartext, när Stripe själv pekar ut den.
 *
 * Ett larm som bara säger "balance_insufficient" lämnar mottagaren att gissa.
 * Stripe skriver faktiskt ut vad som är fel — att saldot betalas ut
 * automatiskt — och då ska larmet säga vad man gör åt det.
 */
export function trolligOrsak(error: string | null): string | null {
  if (!error) return null;
  if (/automatically being paid out|insufficient funds|balance_insufficient/i.test(error)) {
    return (
      "Stripe-saldot betalas ut automatiskt till banken, så det finns inget kvar " +
      "att föra över när jobbet kör. Slå på manuella utbetalningar i Stripe " +
      "(Inställningar → Utbetalningar) så ligger saldot kvar till avräkningen."
    );
  }
  return null;
}
