// Shared attendee-identity helpers for event statistics.
// An attendee may be an app user (customer_id + profile) or a guest ticket
// (guest_name/guest_email). We unify them by email when available so an app
// user and their guest tickets count as the same person.

export interface BookingLike {
  id: string;
  listing_id: string;
  customer_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  checked_in_at: string | null;
  created_at: string;
  scheduled_at?: string | null;
  status: string;
  amount_paid?: number | null;
  profiles?: { full_name: string | null; email: string | null } | null;
  /**
   * Hur personen kom in. Saknas = vanlig biljett. "pass" är ett klipp på ett
   * klippkort (raden är en pass_redemption, inte en bokning), "volunteer" är
   * ett volontär-/taxipass (raden är en taxi_signup).
   */
  kind?: AttendanceKind;
  /** Volontärens roll, bara för kind "volunteer". */
  role?: string | null;
  /** Arrangörens eget namn på passet, bara för kind "volunteer". */
  roleLabel?: string | null;
}

export type AttendanceKind = "ticket" | "pass" | "volunteer";

/**
 * Närvaro som inte är en bokningsrad på kvällen: klipp på klippkort och
 * volontärpass. Utan dem saknas folk i statistiken fast de stod i rummet —
 * Pernilla drog ett klipp på sitt Allt-kort och syntes ingenstans, och
 * taxidansarna syntes aldrig. Raderna formas som bokningar så att resten av
 * statistiken (deltagare, återkommande, incheckade) kan räkna dem rakt av.
 *
 * Ett klipp räknas som incheckad i samma ögonblick det dras: klippet dras i
 * dörren, det finns ingen "bokad men kom inte" för ett klipp. Ett volontärpass
 * har däremot en riktig incheckning, så en dansare som uteblev syns som ej
 * incheckad.
 *
 * `clipRevenue` styr om klippets andel av kortet räknas som intäkt. Per kväll
 * är det rätt (det är kvällens del, samma som i avräkningen). Över alla event
 * är det fel, för där ligger hela kortköpet redan som intäkt på kortets rad.
 */
export async function loadExtraAttendance(
  admin: { from: (t: string) => any },
  hostId: string,
  opts: { clipRevenue: boolean }
): Promise<BookingLike[]> {
  const rows: BookingLike[] = [];

  type ClipRow = {
    id: string;
    listing_id: string;
    redeemed_at: string;
    amount_paid_ore: number | null;
    booking: { customer_id: string | null; guest_name: string | null; guest_email: string | null } | null;
  };
  const { data: clips } = await admin
    .from("pass_redemptions")
    .select("id, listing_id, redeemed_at, amount_paid_ore, booking:bookings!inner(customer_id, guest_name, guest_email, creator_id)")
    .eq("booking.creator_id", hostId);
  for (const c of (clips ?? []) as ClipRow[]) {
    rows.push({
      id: c.id,
      listing_id: c.listing_id,
      customer_id: c.booking?.customer_id ?? null,
      guest_name: c.booking?.guest_name ?? null,
      guest_email: c.booking?.guest_email ?? null,
      checked_in_at: c.redeemed_at,
      created_at: c.redeemed_at,
      scheduled_at: c.redeemed_at,
      status: "confirmed",
      amount_paid: opts.clipRevenue ? c.amount_paid_ore ?? 0 : 0,
      kind: "pass",
    });
  }

  type SignupRow = {
    id: string;
    dancer_id: string;
    checked_in_at: string | null;
    created_at: string;
    shift: { listing_id: string; starts_at: string; role: string; role_label: string | null; listing: { user_id: string } | null } | null;
  };
  const { data: signups } = await admin
    .from("taxi_signups")
    .select("id, dancer_id, checked_in_at, created_at, shift:taxi_shifts!inner(listing_id, starts_at, role, role_label, listing:listings!inner(user_id))")
    .eq("status", "booked")
    .eq("shift.listing.user_id", hostId);
  for (const s of (signups ?? []) as SignupRow[]) {
    if (!s.shift) continue;
    rows.push({
      id: s.id,
      listing_id: s.shift.listing_id,
      customer_id: s.dancer_id,
      guest_name: null,
      guest_email: null,
      checked_in_at: s.checked_in_at,
      created_at: s.created_at,
      scheduled_at: s.shift.starts_at,
      status: "confirmed",
      amount_paid: 0,
      kind: "volunteer",
      role: s.shift.role,
      roleLabel: s.shift.role_label,
    });
  }

  return rows;
}

// bookings.customer_id references auth.users, not profiles, so PostgREST can't
// embed profiles directly. Fetch the names separately (admin client) and attach.
export async function attachProfiles(
  admin: { from: (t: string) => any },
  bookings: BookingLike[]
): Promise<BookingLike[]> {
  const ids = Array.from(
    new Set(bookings.map((b) => b.customer_id).filter((x): x is string => !!x))
  );
  const byId = new Map<string, { full_name: string | null; email: string | null }>();
  if (ids.length) {
    const { data } = await admin.from("profiles").select("id, full_name, email").in("id", ids);
    for (const p of (data ?? []) as { id: string; full_name: string | null; email: string | null }[]) {
      byId.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }
  return bookings.map((b) => ({
    ...b,
    profiles: b.customer_id ? byId.get(b.customer_id) ?? null : null,
  }));
}

export function bookingEmail(b: BookingLike): string | null {
  const e = b.profiles?.email || b.guest_email || null;
  return e ? e.trim().toLowerCase() : null;
}

/** Stable identity key: email → user id → booking id (last resort). */
export function attendeeKey(b: BookingLike): string {
  const email = bookingEmail(b);
  if (email) return `e:${email}`;
  if (b.customer_id) return `u:${b.customer_id}`;
  return `b:${b.id}`;
}

export function attendeeName(b: BookingLike): string {
  return b.profiles?.full_name || b.guest_name || "Gäst";
}

export interface AttendeeAgg {
  key: string;
  name: string;
  email: string | null;
  eventIds: Set<string>;
  bookings: number;
  checkedIn: number;
  firstSeen: string;
  lastSeen: string;
}

/** Group confirmed/completed bookings into one record per attendee. */
export function groupAttendees(bookings: BookingLike[]): Map<string, AttendeeAgg> {
  const map = new Map<string, AttendeeAgg>();
  for (const b of bookings) {
    const key = attendeeKey(b);
    const existing = map.get(key);
    if (existing) {
      existing.eventIds.add(b.listing_id);
      existing.bookings += 1;
      if (b.checked_in_at) existing.checkedIn += 1;
      if (b.created_at < existing.firstSeen) existing.firstSeen = b.created_at;
      if (b.created_at > existing.lastSeen) existing.lastSeen = b.created_at;
      // Prefer a real name over the "Gäst" fallback.
      if (existing.name === "Gäst") existing.name = attendeeName(b);
    } else {
      map.set(key, {
        key,
        name: attendeeName(b),
        email: bookingEmail(b),
        eventIds: new Set([b.listing_id]),
        bookings: 1,
        checkedIn: b.checked_in_at ? 1 : 0,
        firstSeen: b.created_at,
        lastSeen: b.created_at,
      });
    }
  }
  return map;
}
