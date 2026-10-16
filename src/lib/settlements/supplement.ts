/**
 * Kompletterande avräkning: efterbetalning för en kväll som redan reglerats.
 *
 * Bakgrund. Avräkningen körs en gång, strax efter midnatt, och raden låses
 * sedan som "paid". Allt som ändrar kvällens intäkt EFTER det ögonblicket når
 * aldrig partnern: en sen betalning för en kväll gästen redan dansat, ett klipp
 * som registreras i efterhand, en biljett som flyttas hit från en annan kväll.
 * Varje sådan rättelse blev en skuld som någon fick minnas och föra över för
 * hand — och den som glöms bort syns ingenstans.
 *
 * Den här modulen räknar ut mellanskillnaden. Den är ren och utan I/O av samma
 * skäl som splitEventRevenue: den avgör hur mycket pengar som lämnar bolaget,
 * och måste gå att pröva uttömmande utan databas.
 *
 * Alla belopp i ÖRE.
 */

import type { Split } from "./split";

/** Vad som redan betalats för kvällen, och vad den är värd nu. */
export interface SupplementInput {
  /**
   * Partnerandelen omräknad från kvällens NUVARANDE bokningar och klipp, med
   * samma funktion som den ursprungliga avräkningen använde.
   */
  split: Split;
  /**
   * Summan av det som faktiskt förts över för kvällen: ursprungsavräkningen
   * plus tidigare kompletteringar. Bara överföringar som gått igenom räknas —
   * en rad som ligger kvar i "pending" är inte pengar partnern har.
   */
  alreadyPaidOre: number;
  /**
   * Status på ursprungsavräkningen. En komplettering förutsätter att grunden
   * är reglerad; är den inte det ska den vanliga körningen göra jobbet i
   * stället, och de två får inte betala för samma kväll samtidigt.
   */
  primaryStatus: string | null;
}

export type SupplementOutcome =
  /** Det finns en mellanskillnad att föra över. */
  | { kind: "due"; deltaOre: number; dueOre: number; alreadyPaidOre: number }
  /** Kvällen är i balans. Det normala utfallet. */
  | { kind: "balanced"; dueOre: number; alreadyPaidOre: number }
  /** Partnern har fått FÖR MYCKET. Kräver en människa — se nedan. */
  | { kind: "overpaid"; excessOre: number; dueOre: number; alreadyPaidOre: number }
  /** Går inte att komplettera ännu, med orsak. */
  | { kind: "skip"; reason: string };

/**
 * Vad ska hända med kvällen?
 *
 * Överbetalning hanteras MEDVETET inte automatiskt. Den uppstår när något
 * återbetalats efter avräkningen, och att rätta den innebär att dra tillbaka
 * pengar från partnerns konto. Det är en åtgärd med en motpart i andra änden
 * som planerat sin ekonomi efter beskedet, och den ska fattas av en människa
 * som kan höra av sig först. Körningen rapporterar den i stället, tydligt.
 */
export function decideSupplement(input: SupplementInput): SupplementOutcome {
  const { split, alreadyPaidOre, primaryStatus } = input;

  if (primaryStatus !== "paid") {
    return {
      kind: "skip",
      reason:
        primaryStatus === null
          ? "ingen ursprunglig avräkning"
          : `ursprunglig avräkning har status ${primaryStatus}`,
    };
  }

  if (!Number.isFinite(alreadyPaidOre) || alreadyPaidOre < 0) {
    return { kind: "skip", reason: "ogiltig summa redan utbetalt" };
  }

  const dueOre = split.partnerOre;
  const deltaOre = dueOre - alreadyPaidOre;

  if (deltaOre === 0) return { kind: "balanced", dueOre, alreadyPaidOre };
  if (deltaOre < 0) {
    return { kind: "overpaid", excessOre: -deltaOre, dueOre, alreadyPaidOre };
  }

  return { kind: "due", deltaOre, dueOre, alreadyPaidOre };
}

/**
 * Stripe-gruppen för en komplettering.
 *
 * Måste skilja sig från ursprungsavräkningens `settlement_<listing>`. Den
 * körningen letar upp en tidigare överföring på just den gruppen för att inte
 * betala två gånger; delade kompletteringen grupp med den skulle den hittas
 * som "redan gjord" och mellanskillnaden aldrig gå iväg. Löpnumret gör varje
 * komplettering till sin egen idempotensnyckel.
 */
export function supplementTransferGroup(listingId: string, seq: number): string {
  return `settlement_${listingId}_k${seq}`;
}

/**
 * Hur långt bakåt körningen tittar.
 *
 * Avgränsningen finns för att arbetet ska vara begränsat och förutsägbart, inte
 * för att en äldre skuld skulle vara mindre verklig. En kväll som glidit isär
 * för länge sedan ska redas ut för hand, inte rättas tyst av ett nattjobb
 * månader senare.
 */
export const KOMPLETTERING_FONSTER_DAGAR = 30;

/** Är kvällen innanför fönstret? Båda datumen som "YYYY-MM-DD". */
export function inomFonster(eventDate: string, today: string, dagar = KOMPLETTERING_FONSTER_DAGAR): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return false;
  const e = Date.parse(`${eventDate}T00:00:00Z`);
  const t = Date.parse(`${today}T00:00:00Z`);
  if (Number.isNaN(e) || Number.isNaN(t)) return false;
  const diff = (t - e) / 86_400_000;
  return diff >= 0 && diff <= dagar;
}
