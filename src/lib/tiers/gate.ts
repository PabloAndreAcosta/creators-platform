import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nivågrind för funktioner som faktiskt är sålda som Premium.
 *
 * VARFÖR DEN BEHÖVS. Genomgången 2026-10-05 visade att sex "förmåner" i Guld
 * och Premium inte var grindade någonstans — de fanns gratis för alla medan
 * prislistan tog betalt för dem. Fyra av dem löstes genom att flytta dem till
 * nivåtaken eller stryka dem. De två som är kvar kan bara lösas med en riktig
 * grind: Facebook-synk och statistikexport.
 *
 * HELLRE EN GRIND ÄN ETT LÖFTE. Att sälja något ogrindat är inte generöst,
 * det är oärligt mot den som betalar för det.
 *
 * Svarar 402 Payment Required, inte 403. Skillnaden är att det inte är
 * förbjudet — det går att låsa upp genom att uppgradera, och svaret bär
 * vilken funktion och vilken nivå det gäller så att gränssnittet kan säga det.
 */

const PREMIUM = new Set(["premium"]);
const GULD_ELLER_BATTRE = new Set(["guld", "premium"]);

async function tierFor(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db.from("profiles").select("tier").eq("id", userId).maybeSingle();
  return ((data?.tier as string) || "gratis").toLowerCase();
}

/** Premium krävs. null = okej; annars nivån användaren faktiskt har. */
export async function requirePremium(
  db: SupabaseClient,
  userId: string
): Promise<string | null> {
  const tier = await tierFor(db, userId);
  return PREMIUM.has(tier) ? null : tier;
}

/** Guld eller Premium krävs. null = okej. */
export async function requireGuld(
  db: SupabaseClient,
  userId: string
): Promise<string | null> {
  const tier = await tierFor(db, userId);
  return GULD_ELLER_BATTRE.has(tier) ? null : tier;
}
