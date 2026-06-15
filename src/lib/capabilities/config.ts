// Creator capabilities that can be unlocked with "nycklar" (or granted by tier).
// The event pack unlocks the whole Kiz-Lab-evening toolset for one event.

export type Capability = "tickets" | "live" | "scan";

export const EVENT_PACK = "event_pack";

// What each unlock grants.
export const PACK_INCLUDES: Record<string, Capability[]> = {
  [EVENT_PACK]: ["tickets", "live", "scan"],
};

// Cost in nycklar per unlock.
export const UNLOCK_COSTS: Record<string, number> = {
  [EVENT_PACK]: 2,
};
