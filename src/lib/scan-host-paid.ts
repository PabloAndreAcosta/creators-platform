import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Skanning är en betalfunktion, men för crew följer den VÄRDENS nivå, inte
 * den egna. Pablo 2026-11-07: värden betalar och delegerar skanningen till
 * sitt team – medvärdar och volontärer ska inte behöva egen prenumeration
 * för att släppa in gäster på någon annans kväll.
 *
 * Ett konto räknas som betalande med Guld/Premium-nivå, en aktiv
 * prenumeration (även provperiod) eller rollen lokal. Betaläget hanteras av
 * anroparen.
 */
export async function isPaidAccount(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data: prof } = await admin.from("profiles").select("tier, role").eq("id", userId).maybeSingle();
  if (prof?.tier === "guld" || prof?.tier === "premium") return true;
  // Lokalernas nivåer är avvecklade (2026-09-29, se stripe/config.ts) – en
  // lokal är en avtalspart, inte en abonnent, och kan inte köpa en nivå.
  // Skanningen får därför inte hänga på en prenumeration den inte kan teckna.
  if (prof?.role === "venue") return true;
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .limit(1)
    .maybeSingle();
  return !!sub;
}

export interface DelegatedScan {
  /** Har fått skanna-rätt av någon värd (crew) eller en lokal (dörrteam). */
  delegated: boolean;
  /** Minst en av de värdarna/lokalerna är betalande – då öppnas skannern. */
  hostPaid: boolean;
}

/** Skanna-rätt som andra gett användaren, och om någon av givarna betalar. */
export async function delegatedScanAccess(admin: SupabaseClient, userId: string): Promise<DelegatedScan> {
  const owners = new Set<string>();

  const { data: collabs } = await admin
    .from("listing_collaborators")
    .select("listing:listings(user_id)")
    .eq("user_id", userId)
    .eq("status", "accepted")
    .eq("can_scan", true);
  for (const c of (collabs ?? []) as unknown as { listing: { user_id: string } | null }[]) {
    if (c.listing?.user_id) owners.add(c.listing.user_id);
  }

  const { data: members } = await admin
    .from("venue_members")
    .select("venue_profile_id, capabilities")
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .is("removed_at", null);
  for (const m of (members ?? []) as { venue_profile_id: string; capabilities: string[] | null }[]) {
    if ((m.capabilities ?? []).includes("scan") && m.venue_profile_id) owners.add(m.venue_profile_id);
  }

  if (owners.size === 0) return { delegated: false, hostPaid: false };
  for (const owner of owners) {
    if (await isPaidAccount(admin, owner)) return { delegated: true, hostPaid: true };
  }
  return { delegated: true, hostPaid: false };
}
