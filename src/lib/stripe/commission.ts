export type MemberTier = 'gratis' | 'guld' | 'premium';

export interface PayoutBreakdown {
  gross: number;
  commission: number;
  net: number;
  commissionRate: number;
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
 */
export const COMMISSION_RATES: Record<MemberTier, number> = {
  gratis: 0.08,
  guld: 0.05,
  premium: 0.03,
};

/**
 * Taxidansarnas förmån (Fas 5) var 8/5/3 när standard var 15/8/3. Sedan
 * standardtrappan sänkts till samma siffror är förmånen identisk med den
 * vanliga satsen — den ger inget längre.
 *
 * Tabellen ligger kvar med flit i stället för att tas bort: den är fortfarande
 * den som gäller för taxidansare, och blir standardtrappan någonsin dyrare
 * igen ska förmånen finnas kvar på sin gamla nivå utan att någon behöver minnas
 * vad den var. Att radera den vore att tyst dra in något som utlovats.
 */
export const TAXI_DANCER_COMMISSION_RATES: Record<MemberTier, number> = {
  gratis: 0.08,
  guld: 0.05,
  premium: 0.03,
};

export const DISCOUNT_RATES: Record<'guld' | 'premium', number> = {
  guld: 0.10,
  premium: 0.20,
};

/**
 * Returns the commission rate for a creator based on their tier and
 * (optionally) their creator_subcategory. Taxi dancers get reduced
 * rates as a Fas 5 special offer.
 *
 * Standard: gratis 8%, guld 5%, premium 3%
 * Taxi dancer: samma siffror sedan 2026-09-29 (se tabellen ovan)
 */
export function getCreatorCommissionRate(
  tier: string,
  creatorSubcategory?: string | null
): number {
  // Fallbacken pekar på gratisnivån i stället för en hårdkodad siffra. Den var
  // 0.15 och blev efter sänkningen DYRARE än alla riktiga nivåer — en okänd
  // eller felstavad tier hade alltså tagit mer betalt än gratisnivån. Testet
  // fångade det; den som ändrar trappan nästa gång slipper tänka på det.
  if (creatorSubcategory === "taxi_dancer") {
    return TAXI_DANCER_COMMISSION_RATES[tier as MemberTier] ?? TAXI_DANCER_COMMISSION_RATES.gratis;
  }
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
 * Calculates the discounted price for a user based on their membership tier.
 * Gratis users pay full price.
 * Guld members get 10% discount, Premium members get 20% discount.
 *
 * Membership discounts are DISABLED during the free beta (memberships cost
 * nothing, so the tier discounts shouldn't apply). Re-enable by setting
 * NEXT_PUBLIC_DISCOUNTS_ENABLED=true once memberships are paid.
 */
export function calculateDiscountedPrice(
  originalPrice: number,
  userTier: string | null
): number {
  if (process.env.NEXT_PUBLIC_DISCOUNTS_ENABLED !== 'true') return originalPrice;
  if (!userTier || userTier === 'gratis') return originalPrice;

  const discount = DISCOUNT_RATES[userTier as 'guld' | 'premium'];
  if (discount === undefined) return originalPrice;

  return Math.round(originalPrice * (1 - discount) * 100) / 100;
}
