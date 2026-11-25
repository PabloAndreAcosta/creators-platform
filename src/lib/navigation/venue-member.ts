/**
 * Menyval som ett lokalteam låser upp.
 *
 * Menyerna styrs av kontots egen roll (registry.ts). En medlem i ett lokalteam
 * har ofta rollen publik, och såg därför varken Evenemang eller Skanna — fast
 * lokalen gett hen rätt till båda. Rollen ska inte ändras för det (rollen säger
 * vad kontot ÄR, behörigheten vad personen får göra åt någon annan), så
 * behörigheterna översätts här till enskilda sökvägar som menyerna tar med
 * utöver rollens.
 *
 * Bara sidor som faktiskt fungerar för en medlem står med:
 * - events → /app/events: listan visar lokalens evenemang, och Skapa erbjuder
 *   "skapa åt lokalen".
 * - scan → /app/scan: skannern frågar /api/tickets/can-scan, som ser dörrteamet.
 * - page → /app/venue-requests: förfrågningarna för lokalerna hen sköter.
 * bookings, messages och stats nås per evenemang från eventlistan, inte från en
 * egen menypost.
 */

import type { VenueCapability } from "@/lib/venues/members";

const PATHS_BY_CAPABILITY: Partial<Record<VenueCapability, string>> = {
  events: "/app/events",
  scan: "/app/scan",
  page: "/app/venue-requests",
};

/** Ordningen sidan efter accept väljer i: det man oftast kommit för först. */
const LANDING_ORDER: VenueCapability[] = ["events", "scan", "page"];

/**
 * Sökvägarna som behörigheterna låser upp. Tar en lista per lokal, eftersom en
 * person kan tillhöra flera lokaler med olika behörigheter.
 */
export function navPathsForVenueCapabilities(
  perVenue: readonly (readonly string[])[]
): string[] {
  const out = new Set<string>();
  for (const caps of perVenue) {
    for (const c of caps) {
      const path = PATHS_BY_CAPABILITY[c as VenueCapability];
      if (path) out.add(path);
    }
  }
  return [...out];
}

/**
 * Vart en ny medlem skickas när hen tackat ja. Inte till /app, där inget
 * pekade vidare: till den sida behörigheten faktiskt gäller.
 */
export function memberLandingPath(capabilities: readonly string[]): string {
  for (const c of LANDING_ORDER) {
    if (capabilities.includes(c)) return PATHS_BY_CAPABILITY[c]!;
  }
  return "/app";
}
