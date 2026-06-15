import type { SupabaseClient } from "@supabase/supabase-js";
import { capabilitiesEnforced } from "./flag";
import { hasCapability, tierGrants } from "./access";
import { EVENT_PACK, UNLOCK_COSTS } from "./config";

export type CapabilityLocked = {
  locked: true;
  capability: string;
  cost: number;
};

/**
 * Whether an event's settings mean it "sells tickets" — a paid event or one
 * with a guest cap (a real managed door with a guest list). This is the point
 * where the `tickets` capability is required under enforcement. Free, uncapped
 * events stay open.
 */
export function isTicketedEvent(
  price: number | null | undefined,
  maxGuests: number | null | undefined
): boolean {
  return (price != null && price > 0) || maxGuests != null;
}

/**
 * For an EXISTING listing: whether the host still needs to unlock event_pack
 * before this ticketed event is allowed under enforcement. Returns the locked
 * payload, or null if allowed (enforcement off, tier grants, already unlocked,
 * not ticketed). Never gates buyers — only the creator's selling enablement.
 */
export async function ticketGateForListing(
  client: SupabaseClient,
  userId: string,
  listingId: string,
  price: number | null | undefined,
  maxGuests: number | null | undefined
): Promise<CapabilityLocked | null> {
  if (!isTicketedEvent(price, maxGuests)) return null;
  if (!(await capabilitiesEnforced())) return null;
  if (await hasCapability(client, userId, "tickets", listingId)) return null;
  return { locked: true, capability: EVENT_PACK, cost: UNLOCK_COSTS[EVENT_PACK] };
}

/**
 * For a NEW event (no listing row yet, so no event-scoped unlock can exist):
 * a non-tier-granted host selling tickets must unlock after creation. We create
 * the listing as a draft (is_active=false) and let the unlock publish it.
 */
export async function ticketGateForNewEvent(
  tier: string | null | undefined,
  price: number | null | undefined,
  maxGuests: number | null | undefined
): Promise<CapabilityLocked | null> {
  if (!isTicketedEvent(price, maxGuests)) return null;
  if (tierGrants(tier)) return null;
  if (!(await capabilitiesEnforced())) return null;
  return { locked: true, capability: EVENT_PACK, cost: UNLOCK_COSTS[EVENT_PACK] };
}
