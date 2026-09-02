/**
 * Delad kapacitet mellan biljettyper.
 *
 * En kväll kan bestå av flera pass med olika tak: practica för 80, workshop för
 * 30, social för 100. Varje pass är en POTT. En biljettyp drar från de potter
 * den ger tillträde till — kombinationsbiljetten från alla tre.
 *
 * Därför tillhör en typ FLERA potter, inte en. Med bara en koppling skulle
 * kombinationsbiljetten bara räknas mot ett av passen, och de andra kunna
 * översäljas.
 *
 * Evenemangets egen capacity blir samtidigt fel verktyg när passen ligger vid
 * olika tider: 80 på practican och 100 på socialen är inte 180 personer i
 * rummet samtidigt. Låt den vara tom och låt potterna hålla i taken.
 */

export interface TicketTypeRow {
  name: string;
  capacity: number | null;
  /** Potterna raden tillhör. Tom lista = ingen delad kapacitet. */
  pools: string[];
}

export interface ResolvedPool {
  name: string;
  capacity: number;
}

/** Delar upp fritextfältet "Practica, Workshop" i namn. */
export function parsePoolNames(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const name = part.trim();
    if (name && !out.includes(name)) out.push(name);
  }
  return out;
}

/**
 * Räknar fram potterna och deras tak ur raderna.
 *
 * Taket hämtas BARA från rader som tillhör exakt en pott. En rad som tillhör
 * flera — kombinationsbiljetten — säger ingenting om hur stort något enskilt
 * pass är, så dess kapacitetsfält är meningslöst där och ignoreras. Passets
 * storlek står på passets egen biljett.
 *
 * Säger två rader olika om samma pott vinner det minsta: en pott som blir för
 * stor säljer in folk som inte får plats, och det upptäcks i dörren.
 */
export function resolvePools(rows: readonly TicketTypeRow[]): ResolvedPool[] {
  const byName = new Map<string, number>();

  for (const r of rows) {
    if (r.pools.length !== 1) continue;
    if (r.capacity == null || r.capacity <= 0) continue;
    const name = r.pools[0];
    const current = byName.get(name);
    byName.set(name, current == null ? r.capacity : Math.min(current, r.capacity));
  }

  return [...byName.entries()]
    .map(([name, capacity]) => ({ name, capacity }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

/**
 * Radens EGNA kapacitet när den tillhör minst en pott: ingen.
 *
 * Taket sitter på potten. Två tak samtidigt gör att en typ kan ta slut medan
 * potten har platser kvar, vilket ser ut som en bugg för den som står och köper.
 */
export function ownCapacityFor(row: TicketTypeRow): number | null {
  return row.pools.length > 0 ? null : row.capacity;
}

export interface TicketTypeForSale {
  id: string;
  name: string;
  price: number;
  capacity: number | null;
  tickets_sold: number;
  /** Potterna typen drar från, med tak och hur mycket som redan tagits. */
  pools?: { id: string; capacity: number | null; sold: number }[];
}

/**
 * Ger varje typ det tak som faktiskt begränsar den.
 *
 * En typ som tillhör flera potter tar slut när DEN TRÅNGASTE tar slut — en
 * kombinationsbiljett kan inte säljas när workshoppen är full, hur många
 * platser socialen än har kvar. Därför väljs den pott som har minst kvar, och
 * dess tak och sålda antal används.
 *
 * Utan det här ser pottbiljetter obegränsade ut för köparen, eftersom deras egen
 * capacity är null. De skulle klicka och nekas först i kassan — sista stället
 * man vill leverera det beskedet.
 */
export function applyPoolLimits<T extends TicketTypeForSale>(types: readonly T[]): T[] {
  return types.map((t) => {
    const pools = (t.pools ?? []).filter((p) => p.capacity != null);
    if (pools.length === 0) return t;

    let trangast = pools[0];
    let minstKvar = (trangast.capacity as number) - trangast.sold;
    for (const p of pools.slice(1)) {
      const kvar = (p.capacity as number) - p.sold;
      if (kvar < minstKvar) {
        minstKvar = kvar;
        trangast = p;
      }
    }

    return { ...t, capacity: trangast.capacity, tickets_sold: trangast.sold };
  });
}
