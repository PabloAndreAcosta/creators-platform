// Single source of truth for account roles.
//
// Canonical values (English) are stored in profiles.role:
//   creator  — a kreatör (artist/creator) who appears on the marketplace
//   venue    — an arrangör/plats/bolag (formerly "upplevelse"/"experience")
//   customer — the audience/buyer side (formerly "publik")
//
// Only SELLER_ROLES are shown on the public marketplace.

export const ROLES = {
  CREATOR: "creator",
  VENUE: "venue",
  CUSTOMER: "customer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Canonical roles that should be listed on the public marketplace (never buyers). */
export const SELLER_ROLES: Role[] = [ROLES.CREATOR, ROLES.VENUE];

/**
 * Seller role values for DB `.in("role", …)` filters — includes legacy Swedish
 * spellings so the marketplace stays correct both before and after the role
 * normalization migration runs. After migration the legacy values simply
 * don't exist anymore.
 */
export const SELLER_ROLE_VALUES: string[] = [
  "creator",
  "kreator",
  "venue",
  "upplevelse",
  "experience",
];

/**
 * Map any stored role value to a canonical Role, tolerating legacy Swedish
 * spellings (kreator/upplevelse/publik) and the old "experience" value so the
 * code keeps working even if a row hasn't been migrated yet. Returns null for
 * unknown values.
 */
export function normalizeRole(role: string | null | undefined): Role | null {
  switch ((role ?? "").toLowerCase()) {
    case "creator":
    case "kreator":
      return ROLES.CREATOR;
    case "venue":
    case "upplevelse":
    case "experience":
      return ROLES.VENUE;
    case "customer":
    case "publik":
      return ROLES.CUSTOMER;
    default:
      return null;
  }
}

export function isSeller(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === ROLES.CREATOR || r === ROLES.VENUE;
}

export function isCreatorRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.CREATOR;
}

export function isVenueRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.VENUE;
}

export function isBuyer(role: string | null | undefined): boolean {
  return normalizeRole(role) === ROLES.CUSTOMER;
}
