/**
 * Beta mode flag — when true, all features are unlocked for all users.
 * Controlled via NEXT_PUBLIC_BETA_MODE env variable.
 * Set to "false" or remove when beta period ends.
 */
export const BETA_MODE = process.env.NEXT_PUBLIC_BETA_MODE === "true";
