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
  const seats =
    opts.capacity && opts.ticketsSold != null
      ? ` (${opts.ticketsSold}/${opts.capacity} sålda)`
      : opts.ticketsSold != null
        ? ` · ${opts.ticketsSold} sålda totalt`
        : "";
  const message = `${qty} biljett${qty > 1 ? "er" : ""} till "${opts.title}" – ${kr(opts.amountOre)} kr${seats}.`;
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "ticket_sold",
        title: "Ny biljett såld 🎟️",
        message,
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
        title: "Slutsålt! 🔥",
        message: `"${opts.title}" är nu slutsålt.`,
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
  const who = opts.name ? `${opts.name} ` : "Någon ";
  await Promise.all(
    recipients.map((userId) =>
      createNotification({
        userId,
        type: "waitlist_join",
        title: "Ny på väntelistan ⏳",
        message: `${who}ställde sig i kö till "${opts.title}".`,
        link: `/app/events/${opts.listingId}/waitlist`,
      })
    )
  );
}
