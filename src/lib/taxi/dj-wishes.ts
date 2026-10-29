/**
 * DJ-önskemål till practicorna. Gästerna önskar och röstar; vid 50 röster
 * lovar arrangören att försöka boka DJ:n. En röst per person och önskemål.
 * Rena funktioner.
 */

export const DJ_WISH_GOAL = 50;

export function cleanDjName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const s = input.replace(/\s+/g, " ").trim().slice(0, 80);
  return s.length >= 2 ? s : null;
}

/** Bara http(s)-länkar, till exempel Instagram eller SoundCloud. */
export function cleanDjLink(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  try {
    const u = new URL(input.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 300) : null;
  } catch {
    return null;
  }
}

export interface WishRow {
  id: string;
  name: string;
  status: "open" | "booking" | "booked" | "hidden";
  votes: number;
}

/** Synliga önskemål, flest röster först; nått målet = "vi försöker boka". */
export function rankWishes(rows: readonly WishRow[]): (WishRow & { reachedGoal: boolean })[] {
  return rows
    .filter((r) => r.status !== "hidden")
    .map((r) => ({ ...r, reachedGoal: r.votes >= DJ_WISH_GOAL || r.status !== "open" }))
    .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name, "sv"));
}
