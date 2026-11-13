import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Nivågrinden, nu alltid öppen.
 *
 * Guld och Premium togs bort 2026-11-13: en nivå, gratis, allt ingår, och
 * 8 % provision för alla. Ingen betalade för nivåerna (sex konton, alla
 * beviljade utan kostnad) och de låste just det som gör Usha annorlunda —
 * kiosken, statistiken, att låta någon annan skanna.
 *
 * Funktionerna finns kvar med sina gamla namn så att anropsställena inte
 * behöver skrivas om, och så att en grind går att återinföra på ett ställe
 * om det någonsin blir aktuellt. Svaret är null = okej, för alla.
 */

export async function requirePremium(_db: SupabaseClient, _userId: string): Promise<string | null> {
  return null;
}

export async function requireGuld(_db: SupabaseClient, _userId: string): Promise<string | null> {
  return null;
}
