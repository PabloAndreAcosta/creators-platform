export type MemberTier = 'gratis' | 'guld' | 'premium';

export interface PayoutBreakdown {
  gross: number;
  commission: number;
  net: number;
  commissionRate: number;
}

/**
 * Provisionen sedan 2026-11-13: 3,5 % + 3,50 kr per såld biljett, samma för
 * alla. Pablo valde formen efter Stripes egen (1,5 % + 1,80 kr per köp): en
 * ren procentsats förlorar på billiga biljetter och tar för mycket på dyra.
 * Med en fast del går ingen biljett back, rubriken blir "3,5 %" och en kurs
 * för 450 kr kostar 19,25 kr — under Billettos 26.
 *
 * Den fasta delen tas per biljett (branschstandard, enklast att förklara).
 * Gratis biljetter kostar ingenting alls.
 */
export const PLATFORM_COMMISSION = {
  rate: 0.035,
  fixedOre: 350,
} as const;

/** Ushas provision i öre för `qty` biljetter à `unitPriceOre`. 0 på gratis. */
export function platformCommissionOre(unitPriceOre: number, qty: number = 1): number {
  if (!unitPriceOre || unitPriceOre <= 0) return 0;
  const n = Math.max(1, qty);
  return Math.round(unitPriceOre * n * PLATFORM_COMMISSION.rate) + PLATFORM_COMMISSION.fixedOre * n;
}

/**
 * Provisionen som andel av beloppet, för de ställen som räknar med en sats
 * (lönens skuggrader, uppdragssidans "du får ca"). På 125 kr blir det 6,3 %,
 * på 450 kr 4,3 %: den fasta delen väger mer ju billigare biljetten är.
 */
export function effectiveCommissionRate(unitPriceOre: number, qty: number = 1): number {
  if (!unitPriceOre || unitPriceOre <= 0) return 0;
  return platformCommissionOre(unitPriceOre, qty) / (unitPriceOre * Math.max(1, qty));
}

/** "3,5 % + 3,50 kr" för text och etiketter. */
export function commissionLabel(): string {
  const pct = (PLATFORM_COMMISSION.rate * 100).toLocaleString("sv-SE");
  const kr = (PLATFORM_COMMISSION.fixedOre / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2 });
  return `${pct} % + ${kr} kr`;
}

/**
 * Provisionstrappan. Sänkt 2026-09-29 från 15/8/3.
 *
 * Femton procent på gratisnivån var inte "lite dyrt" — det var fyra och en
 * halv gång dyrare än alternativen. Nortic och Tikly tar noll av arrangören
 * och femton kronor av köparen; Billetto 3,9 % plus en tia, också av köparen.
 * På en klass för 450 kr betydde vår trappa 67,50 kr av instruktören mot noll
 * hos Nortic. En instruktör som jämför behöver inte tänka längre än så.
 *
 * Vad den gav: 58,50 kr sedan start, allt från Ushas egna kvällar. Ingen
 * tredjepartskreatör har sålt något alls. Satsen skyddade alltså ingen intäkt
 * — den stod i vägen för den.
 *
 * Hela trappan flyttades ned, inte bara första steget: hade gratis blivit 8 %
 * med Guld kvar på 8 % vore Guld gratis att avstå från, och trappan hade
 * upphört att vara en trappa.
 *
 * 2026-11-13: Guld och Premium togs bort. En nivå, 8 % för alla. Tabellen
 * behåller sina tre nycklar eftersom profiles.tier fortfarande kan bära de
 * gamla värdena för konton som hade en nivå — de ska räknas som alla andra,
 * inte falla igenom till något annat.
 */
export const COMMISSION_RATES: Record<MemberTier, number> = {
  gratis: PLATFORM_COMMISSION.rate,
  guld: PLATFORM_COMMISSION.rate,
  premium: PLATFORM_COMMISSION.rate,
};

/**
 * Returns the commission rate for a creator based on their tier and
 * (optionally) their creator_subcategory. Taxi dancers get reduced
 * rates as a Fas 5 special offer.
 *
 * Sedan 2026-11-13 samma sats för alla (PLATFORM_COMMISSION.rate). Den fasta
 * delen ligger inte här — använd platformCommissionOre för kronor.
 */
export function getCreatorCommissionRate(
  tier: string,
  creatorSubcategory?: string | null
): number {
  // Fallbacken pekar på gratisnivån i stället för en hårdkodad siffra. Den var
  // 0.15 och blev efter sänkningen DYRARE än alla riktiga nivåer — en okänd
  // eller felstavad tier hade alltså tagit mer betalt än gratisnivån. Testet
  // fångade det; den som ändrar trappan nästa gång slipper tänka på det.
  // Taxidansarnas egen tabell togs bort 2026-11-13: den var identisk med
  // standardsatsen sedan sänkningen i september och har därför inget att ge.
  void creatorSubcategory;
  return COMMISSION_RATES[tier as MemberTier] ?? COMMISSION_RATES.gratis;
}

/**
 * Calculates the payout breakdown for a booking.
 * Returns gross amount, platform commission, net payout to creator, and the rate applied.
 */
export function calculateCreatorPayout(
  bookingAmount: number,
  creatorTier: string,
  creatorSubcategory?: string | null
): PayoutBreakdown {
  const rate = getCreatorCommissionRate(creatorTier, creatorSubcategory);
  const commission = Math.round(bookingAmount * rate * 100) / 100;
  const net = Math.round((bookingAmount - commission) * 100) / 100;

  return {
    gross: bookingAmount,
    commission,
    net,
    commissionRate: rate,
  };
}

/**
 * Medlemsrabatten (10 % Guld, 20 % Premium) är borta sedan en nivå
 * (2026-11-13). Funktionen finns kvar för anropsställena och ger alltid
 * fullt pris — profiles.tier kan fortfarande bära gamla värden, och de ska
 * inte ge någon rabatt den dag någon råkar sätta en flagga.
 */
export function calculateDiscountedPrice(originalPrice: number, userTier: string | null): number {
  void userTier;
  return originalPrice;
}
