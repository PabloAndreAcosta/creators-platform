// ---------------------------------------------------------------------------
// Serviceavgift för köparen — arrangörens val per event.
//
// Pablo 2026-11-13: provisionen sänktes till 3,5 % + 3,50 kr per biljett, och
// arrangören ska kunna lägga kortkostnaden på köparen. Det får inte göras som
// en kortavgift: sedan 2018 är tilläggsavgifter för konsumentkort förbjudna i
// Sverige och EU (betaltjänstlagen, PSD2). Det som är tillåtet, och det
// Billetto och Tickster gör, är en serviceavgift som är lika oavsett
// betalsätt. Därför heter den serviceavgift och tas ut även när köparen
// betalar med Klarna eller wallet.
//
// Storleken är satt så att den täcker Stripes kortkostnad (1,5 % + 1,80 kr
// per köp) även efter 25 % moms på avgiften: 2 % + 2,50 kr per KÖP, inte per
// biljett — Stripe tar sin fasta del per köp, och den som köper fyra
// biljetter åt gänget ska inte betala fyra fasta avgifter.
//
// Två lägen, arrangören väljer (listings.service_fee_mode):
//   • "buyer"  → avgiften läggs ovanpå i kassan och går till Usha.
//   • "absorb" → ingen avgift alls; provisionen täcker allt. STANDARD.
// Förr betydde "absorb" att avgiften drogs från arrangörens utbetalning. Det
// är borta: provisionen är redan arrangörens pris, en avgift till vore dubbelt.
//
// Kill switch: NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED=false stänger av den
// helt oavsett val. Förr var den avstängd om inte flaggan var "true".
// ---------------------------------------------------------------------------

export const TICKET_SERVICE_FEE = {
  rate: 0.02,
  fixedOre: 250,
} as const;

export type ServiceFeeMode = "buyer" | "absorb";

export function ticketServiceFeeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TICKET_SERVICE_FEE_ENABLED !== "false";
}

/**
 * Serviceavgiften i öre för ett köp av `qty` biljetter à `unitPriceOre`.
 * 0 när arrangören inte valt att köparen betalar, när biljetten är gratis,
 * eller när avgiften är avstängd. Räknas per köp.
 */
export function computeServiceFeeOre(unitPriceOre: number, qty: number = 1, mode: ServiceFeeMode = "absorb"): number {
  if (mode !== "buyer") return 0;
  if (!ticketServiceFeeEnabled()) return 0;
  if (!unitPriceOre || unitPriceOre <= 0) return 0;
  const n = Math.max(1, qty);
  return Math.round(unitPriceOre * n * TICKET_SERVICE_FEE.rate) + TICKET_SERVICE_FEE.fixedOre;
}

/** Lagrat läge → giltigt läge. Saknas värde gäller "absorb": ingen avgift. */
export function serviceFeeMode(raw: unknown): ServiceFeeMode {
  return raw === "buyer" ? "buyer" : "absorb";
}

/** "2 % + 2,50 kr" för text och etiketter, på svenskt vis. */
export function serviceFeeLabel(): string {
  const pct = (TICKET_SERVICE_FEE.rate * 100).toLocaleString("sv-SE");
  const kr = (TICKET_SERVICE_FEE.fixedOre / 100).toLocaleString("sv-SE", { minimumFractionDigits: 2 });
  return `${pct} % + ${kr} kr`;
}
