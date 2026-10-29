/**
 * Elevregistret: säljarens köpare samlade per person. En person är ett konto
 * (customer_id) eller, för gästköp, mejladressen hen lämnade vid köpet.
 * Avbokade köp räknas inte.
 */

export interface RosterBooking {
  id: string;
  listing_id: string;
  customer_id: string | null;
  guest_email: string | null;
  guest_name: string | null;
  status: string;
  scheduled_at: string | null;
  created_at: string;
  amount_paid: number | null;
  sessions_total: number | null;
  sessions_redeemed: number | null;
  pass_expires_at: string | null;
}

export interface ActivePass {
  bookingId: string;
  title: string;
  left: number;
  expiresAt: string | null;
}

export interface Student {
  key: string;
  customerId: string | null;
  guestEmail: string | null;
  name: string | null;
  bookings: number;
  firstAt: string;
  lastAt: string | null;
  nextAt: string | null;
  paidOre: number;
  activePasses: ActivePass[];
  titles: string[];
}

export function studentKey(b: Pick<RosterBooking, "customer_id" | "guest_email">): string | null {
  if (b.customer_id) return `customer:${b.customer_id}`;
  const email = b.guest_email?.trim().toLowerCase();
  return email ? `guest:${email}` : null;
}

const COUNTED = new Set(["pending", "confirmed", "completed"]);

export function buildRoster(
  bookings: RosterBooking[],
  titles: Map<string, string>,
  names: Map<string, string | null>,
  now: Date
): Student[] {
  const byKey = new Map<string, Student>();
  for (const b of bookings) {
    if (!COUNTED.has(b.status)) continue;
    const key = studentKey(b);
    if (!key) continue;
    let s = byKey.get(key);
    if (!s) {
      s = {
        key,
        customerId: b.customer_id,
        guestEmail: b.customer_id ? null : b.guest_email?.trim().toLowerCase() ?? null,
        name: (b.customer_id ? names.get(b.customer_id) : null) ?? b.guest_name ?? null,
        bookings: 0,
        firstAt: b.created_at,
        lastAt: null,
        nextAt: null,
        paidOre: 0,
        activePasses: [],
        titles: [],
      };
      byKey.set(key, s);
    }
    s.bookings += 1;
    s.paidOre += b.amount_paid ?? 0;
    if (b.created_at < s.firstAt) s.firstAt = b.created_at;
    if (!s.name && b.guest_name) s.name = b.guest_name;
    const title = titles.get(b.listing_id);
    if (title && !s.titles.includes(title)) s.titles.push(title);

    // Klippkort: kvar = totalt − använda, så länge det inte gått ut.
    if (b.sessions_total != null) {
      const left = b.sessions_total - (b.sessions_redeemed ?? 0);
      const expired = b.pass_expires_at != null && new Date(b.pass_expires_at) < now;
      if (left > 0 && !expired) {
        s.activePasses.push({ bookingId: b.id, title: title ?? "", left, expiresAt: b.pass_expires_at });
      }
      continue;
    }
    if (b.scheduled_at) {
      if (new Date(b.scheduled_at) <= now) {
        if (!s.lastAt || b.scheduled_at > s.lastAt) s.lastAt = b.scheduled_at;
      } else if (!s.nextAt || b.scheduled_at < s.nextAt) {
        s.nextAt = b.scheduled_at;
      }
    }
  }
  // Senast aktiva först; den som aldrig varit där sist.
  return [...byKey.values()].sort((a, b) => (b.lastAt ?? b.firstAt).localeCompare(a.lastAt ?? a.firstAt));
}

export function matchesStudent(s: Student, q: string): boolean {
  const n = q.trim().toLocaleLowerCase("sv-SE");
  if (!n) return true;
  return [s.name, s.guestEmail, ...s.titles].some((v) => !!v && v.toLocaleLowerCase("sv-SE").includes(n));
}
