import { createClient } from "@/lib/supabase/server";
import type { MemberTier, MemberRole } from "@/types/database";
import { BETA_MODE } from "@/lib/beta";

interface SubscriptionStatus {
  tier: MemberTier;
  role: MemberRole;
  hasActiveSubscription: boolean;
}

/**
 * Returns the subscription status for the currently authenticated user.
 * Falls back to gratis/publik if no profile or subscription exists.
 */
export async function getSubscriptionStatus(
  userId?: string
): Promise<SubscriptionStatus> {
  const supabase = await createClient();

  let uid = userId;
  if (!uid) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    uid = user?.id;
  }

  if (!uid) {
    return { tier: "gratis", role: "customer", hasActiveSubscription: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, role")
    .eq("id", uid)
    .single();

  const tier = (profile?.tier as MemberTier) ?? "gratis";
  const role = (profile?.role as MemberRole) ?? "customer";

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("status")
    .eq("user_id", uid)
    .in("status", ["active", "trialing"])
    .single();

  return {
    tier,
    role,
    hasActiveSubscription: BETA_MODE ? true : !!sub,
  };
}

/**
 * Förr: kastade om användaren låg på gratisnivån. Sedan Guld och Premium togs
 * bort (2026-11-13, en nivå för alla) spärrar den ingenting — den finns kvar
 * för att anropsställena fortfarande vill ha statusen tillbaka.
 */
export async function requirePaidSubscription(): Promise<SubscriptionStatus> {
  return getSubscriptionStatus();
}
