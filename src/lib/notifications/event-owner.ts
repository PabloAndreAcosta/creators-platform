import type { SupabaseClient } from "@supabase/supabase-js";
import { createNotification } from "./create";

// Everyone who administers an event: the owner plus any accepted co-organizers
// with manage rights. They all get the same change notifications (in-app +
// push). Pass a service-role client — listing_collaborators RLS is host-only.
async function eventManagers(
  admin: SupabaseClient,
  listingId: string,
  ownerId: string
): Promise<string[]> {
  const ids = new Set<string>([ownerId]);
  const { data } = await admin
    .from("listing_collaborators")
    .select("user_id")
    .eq("listing_id", listingId)
    .eq("status", "accepted")
    .eq("can_manage", true);
  for (const r of (data ?? []) as { user_id: string | null }[]) {
    if (r.user_id) ids.add(r.user_id);
  }
  return Array.from(ids);
}

function kr(ore: number | null | undefined): string {
  return Math.round((ore ?? 0) / 100).toLocaleString("sv-SE");
}

// The people working the door: managers plus crew with can_scan. A Swish
// payment from the event page waits for someone at the entrance to compare it
// with the Swish app, so the one standing there must hear about it — not only
// the owner, who may be at home (17 Nov: seven Swish buys sat unconfirmed all
// evening while Christian ran the door without being told).
async function entranceCrew(
  admin: SupabaseClient,
  listingId: string,
  ownerId: string
): Promise<string[]> {
  const ids = new Set<string>([ownerId]);
  const { data } = await admin
    .from("listing_collaborators")
    .select("user_id, can_manage, can_scan")
    .eq("listing_id", listingId)
    .eq("status", "accepted");
  for (const r of (data ?? []) as { user_id: string | null; can_manage: boolean | null; can_scan: boolean | null }[]) {
    if (r.user_id && (r.can_manage || r.can_scan)) ids.add(r.user_id);
  }
  return Array.from(ids);
}

/** "26/11" ur "2026-11-26" — siffror läses likadant på alla tre språken. */
export function shortEventDate(date: string | null | undefined): string | null {
  const m = date?.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[2])}/${Number(m[1])}` : null;
}

/**
 * A guest says they have paid with Swish; someone at the door must confirm it.
 *
 * The notice opens the confirmation page for that one booking, where one tap
 * confirms. On Android/Chrome the push also carries a "Confirm" button — it
 * only opens the same page with Confirm highlighted, never confirms by itself:
 * the page needs a session and the same entrance rights as the door. Each
 * booking gets its own push tag so seven purchases are seven notices, not one.
 */
export async function notifyEntranceSwishRequest(
  admin: SupabaseClient,
  opts: {
    listingId: string;
    ownerId: string;
    bookingId: string;
    name: string;
    service: string;
    amountOre: number;
    eventDate?: string | null;
  }
): Promise<void> {
  const recipients = await entranceCrew(admin, opts.listingId, opts.ownerId);
  const link = `/app/swish/bekrafta/${opts.bookingId}`;
  const date = shortEventDate(opts.eventDate);
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "booking_new",
        titleKey: "swishRequestTitle",
        bodyKey: date ? "swishToConfirmMsg" : "swishToConfirmMsgNoDate",
        params: {
          name: opts.name,
          service: opts.service,
          amount: Math.round(opts.amountOre / 100),
          ...(date ? { date } : {}),
        },
        link,
        pushTag: `swish-${opts.bookingId}`,
        pushActions: [{ action: "swish-confirm", titleKey: "swishActionConfirm", url: `${link}?val=bekrafta` }],
      })
    )
  );
}

/** New ticket sale on the owner's event. */
export async function notifyOwnerTicketSold(
  admin: SupabaseClient,
  opts: {
    listingId: string;
    ownerId: string;
    title: string;
    quantity: number;
    amountOre: number | null;
    ticketsSold?: number | null;
    capacity?: number | null;
  }
): Promise<void> {
  const recipients = await eventManagers(admin, opts.listingId, opts.ownerId);
  const qty = opts.quantity || 1;
  // How much we know about the house decides which sentence to use; the count
  // pluralises inside the message so each language does it its own way.
  const bodyKey =
    opts.capacity && opts.ticketsSold != null
      ? "ticketSoldMsgCapacity"
      : opts.ticketsSold != null
        ? "ticketSoldMsgTotal"
        : "ticketSoldMsg";
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "ticket_sold",
        titleKey: "ticketSoldTitle",
        bodyKey,
        params: {
          count: qty,
          title: opts.title,
          amount: kr(opts.amountOre),
          ...(opts.ticketsSold != null ? { sold: opts.ticketsSold } : {}),
          ...(opts.capacity ? { capacity: opts.capacity } : {}),
        },
        link: `/app/events/${opts.listingId}/live`,
      })
    )
  );
}

/** The event just reached capacity. */
export async function notifyOwnerSoldOut(
  admin: SupabaseClient,
  opts: { listingId: string; ownerId: string; title: string }
): Promise<void> {
  const recipients = await eventManagers(admin, opts.listingId, opts.ownerId);
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "event_sold_out",
        titleKey: "soldOutTitle",
        bodyKey: "soldOutMsg",
        params: { title: opts.title },
        link: `/app/events/${opts.listingId}/live`,
      })
    )
  );
}

/** Someone joined the waitlist for a full event. */
export async function notifyOwnerWaitlistJoin(
  admin: SupabaseClient,
  opts: { listingId: string; ownerId: string; title: string; name?: string | null }
): Promise<void> {
  const recipients = await eventManagers(admin, opts.listingId, opts.ownerId);
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "waitlist_join",
        titleKey: "waitlistJoinTitle",
        // No name means the sentence starts with "Someone" — a word, not a
        // value, so it lives in a message of its own.
        bodyKey: opts.name ? "waitlistJoinMsg" : "waitlistJoinMsgAnon",
        params: { ...(opts.name ? { name: opts.name } : {}), title: opts.title },
        link: `/app/events/${opts.listingId}/waitlist`,
      })
    )
  );
}
