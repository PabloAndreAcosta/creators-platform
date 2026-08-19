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
