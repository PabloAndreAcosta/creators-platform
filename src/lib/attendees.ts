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
  status: string;
  amount_paid?: number | null;
  profiles?: { full_name: string | null; email: string | null } | null;
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
