// Lucka 3 — tidsstyrd automatisering: härled biljettförsäljningens läge on-read.
// Ren funktion (ingen I/O, ingen locale) så den kan testas exakt på minuten.

export type SaleState = "on_sale" | "early_bird" | "before" | "sold_out";

export interface SaleInput {
  price: number | null;
  early_bird_start?: string | Date | null;
  early_bird_end?: string | Date | null;
  early_bird_price?: number | null;
  public_sale_at?: string | Date | null;
  capacity?: number | null;
  tickets_sold?: number | null;
}

export interface SaleResult {
  state: SaleState;
  /** Får eventet köpas just nu? */
  buyable: boolean;
  /** Effektivt pris just nu (förköpspris under fönstret, annars ord. pris). */
  price: number;
  /** Relevant tidsgräns för UI-text: när det öppnar (before), stänger
   *  (early_bird) eller släpps publikt (sold_out i gapet). Annars null. */
  until: Date | null;
}

function asDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function getSaleState(listing: SaleInput, now: Date): SaleResult {
  const price = listing.price ?? 0;
  const ebStart = asDate(listing.early_bird_start);
  const ebEnd = asDate(listing.early_bird_end);
  const pub = asDate(listing.public_sale_at);
  const ebPrice = listing.early_bird_price ?? price;
  const capacity = listing.capacity ?? null;
  const sold = listing.tickets_sold ?? 0;

  // 1. Kapacitetstak slår allt annat.
  if (capacity !== null && sold >= capacity) {
    return { state: "sold_out", buyable: false, price, until: null };
  }

  // 2. Förköpsfönster (kräver både start och slut).
  if (ebStart && ebEnd) {
    if (now < ebStart) {
      // Förköpet har inte öppnat än.
      return { state: "before", buyable: false, price: ebPrice, until: ebStart };
    }
    if (now < ebEnd) {
      // Inom förköpsfönstret → förköpspris, köpbart.
      return { state: "early_bird", buyable: true, price: ebPrice, until: ebEnd };
    }
    // Förköpet har stängt.
    if (pub) {
      if (now < pub) {
        // Gapet mellan förköp och publikt släpp → slutsålt, släpps senare.
        return { state: "sold_out", buyable: false, price, until: pub };
      }
      return { state: "on_sale", buyable: true, price, until: null };
    }
    // Inget publikt släpp definierat → slutsålt efter förköpet.
    return { state: "sold_out", buyable: false, price, until: null };
  }

  // 3. Bara schemalagt publikt släpp (utan förköp).
  if (pub) {
    if (now < pub) {
      return { state: "before", buyable: false, price, until: pub };
    }
    return { state: "on_sale", buyable: true, price, until: null };
  }

  // 4. Ingen automatisering → nuvarande beteende: köpbart till ord. pris.
  return { state: "on_sale", buyable: true, price, until: null };
}
