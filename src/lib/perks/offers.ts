/**
 * Från förmånslistan + kodraderna till det sidorna visar.
 *
 * Ren funktion (ingen databas), så att reglerna går att testa:
 *   - en förmån vars kodrad saknas, är avstängd eller hör till en annan serie
 *     visas INTE — sidan ska aldrig lova något som inte går att lösa in;
 *   - en förmån vars sista dag passerat visas inte;
 *   - koden följer bara med när kontot är behörigt.
 */
import type { Perk } from "./catalog";

/** Det vi läser ur series_access_codes. */
export interface PerkCodeRow {
  id: string;
  series_slug: string;
  code: string;
  discount_price: number | null;
  is_active: boolean;
}

export interface PerkOffer {
  perk: Perk;
  kind: "free" | "discount";
  /** Förmånspriset i kr; null när förmånen är gratis. */
  priceKr: number | null;
  /** Koden att boka med. Bara för behöriga konton, annars null. */
  code: string | null;
}

export function buildPerkOffers(
  perks: readonly Perk[],
  rows: readonly PerkCodeRow[],
  opts: { eligible: boolean; today: string }
): PerkOffer[] {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: PerkOffer[] = [];
  for (const perk of perks) {
    if (perk.validUntil && perk.validUntil < opts.today) continue;
    const row = byId.get(perk.accessCodeId);
    if (!row || !row.is_active || row.series_slug !== perk.seriesSlug) continue;
    const free = row.discount_price === null;
    out.push({
      perk,
      kind: free ? "free" : "discount",
      priceKr: free ? null : row.discount_price,
      code: opts.eligible ? row.code : null,
    });
  }
  return out;
}
