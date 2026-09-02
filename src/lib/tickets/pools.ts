/**
 * Delad kapacitet mellan biljettyper.
 *
 * En kväll kan innehålla ett moment som rymmer färre än lokalen — en workshop
 * för 20 i ett rum för 100. Typerna "Workshop" och "Workshop + social" ska då
 * dra från samma 20 platser, annars säljer 20 + 20 in 40 personer.
 *
 * Potten uttrycks i redigeraren genom att två rader anger samma pottnamn. Deras
 * kapacitetsfält blir då pottens tak i stället för radens eget.
 */

export interface TicketTypeRow {
  name: string;
  capacity: number | null;
  pool: string | null;
}

export interface ResolvedPool {
  name: string;
  capacity: number;
}

/**
 * Räknar fram potterna ur raderna.
 *
 * Om medlemmarna anger OLIKA tal vinner det minsta. Det är inte godtyckligt:
 * en pott som råkar bli för stor säljer in folk som inte får plats, och det
 * felet upptäcks i dörren. En pott som blir för liten lämnar en stol tom, och
 * det upptäcks i statistiken. Vid osäkerhet ska felet vara det som går att
 * rätta i efterhand.
 *
 * Rader utan pottnamn ignoreras — de har sin egen kapacitet som förut.
 */
export function resolvePools(rows: readonly TicketTypeRow[]): ResolvedPool[] {
  const byName = new Map<string, number>();

  for (const r of rows) {
    const name = (r.pool ?? "").trim();
    if (!name || r.capacity == null || r.capacity <= 0) continue;
    const current = byName.get(name);
    byName.set(name, current == null ? r.capacity : Math.min(current, r.capacity));
  }

  return [...byName.entries()]
    .map(([name, capacity]) => ({ name, capacity }))
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
}

/**
 * Vad en rad ska ha som EGEN kapacitet när den tillhör en pott.
 *
 * Svaret är null: taket sitter på potten. Läte man kvar radens egen kapacitet
 * skulle två tak gälla samtidigt, och en typ kunna ta slut medan potten har
 * platser kvar — vilket ser ut som en bugg för den som står och köper.
 */
export function ownCapacityFor(row: TicketTypeRow): number | null {
  return (row.pool ?? "").trim() ? null : row.capacity;
}

/** Namnet på potten en rad tillhör, normaliserat. Tom sträng → null. */
export function poolNameFor(row: TicketTypeRow): string | null {
  const n = (row.pool ?? "").trim();
  return n.length > 0 ? n : null;
}

export interface TicketTypeForSale {
  id: string;
  name: string;
  price: number;
  capacity: number | null;
  tickets_sold: number;
  pool_id?: string | null;
  pool_capacity?: number | null;
}

/**
 * Ger varje pottmedlem pottens tak och pottens sålda antal.
 *
 * Utan det här ser en pottbiljett obegränsad ut för köparen: radens egen
 * capacity är null eftersom taket flyttat till potten, och "slutsåld" beräknas
 * på raden. Köparen skulle klicka och först i kassan få veta att det är fullt —
 * och det är sista stället man vill leverera det beskedet.
 *
 * Sålda summeras över potten, så tio köpta workshopbiljetter gör även
 * kombinationsbiljetten tio platser närmare slut.
 */
export function applyPoolLimits<T extends TicketTypeForSale>(types: readonly T[]): T[] {
  const sold = new Map<string, number>();
  for (const t of types) {
    if (!t.pool_id) continue;
    sold.set(t.pool_id, (sold.get(t.pool_id) ?? 0) + (t.tickets_sold ?? 0));
  }

  return types.map((t) => {
    if (!t.pool_id || t.pool_capacity == null) return t;
    return { ...t, capacity: t.pool_capacity, tickets_sold: sold.get(t.pool_id) ?? 0 };
  });
}
