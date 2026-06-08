export const COLLAB_ROLES = ["creator", "taxi_dancer", "volunteer", "co_host"] as const;

export type CollabRole = (typeof COLLAB_ROLES)[number];

/** Roles that require the invitee to be BankID-verified before they can accept. */
export const BANKID_GATED_ROLES = new Set<CollabRole>([
  "creator",
  "taxi_dancer",
  "volunteer",
]);

/** Swedish display labels — UI is Swedish throughout. */
export const COLLAB_ROLE_LABELS: Record<CollabRole, string> = {
  creator: "Kreatör",
  taxi_dancer: "Taxidansare",
  volunteer: "Volontär",
  co_host: "Medvärd",
};

export function isCollabRole(r: unknown): r is CollabRole {
  return typeof r === "string" && (COLLAB_ROLES as readonly string[]).includes(r);
}

export function collabRoleLabel(role: string): string {
  return COLLAB_ROLE_LABELS[role as CollabRole] ?? role;
}
