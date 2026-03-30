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
    return { tier: "gratis", role: "publik", hasActiveSubscription: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, role")
    .eq("id", uid)
    .single();

  const tier = (profile?.tier as MemberTier) ?? "gratis";
  const role = (profile?.role as MemberRole) ?? "publik";

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
 * Server-side guard that throws if the user has a Gratis tier.
 * Use in server actions that require a paid subscription.
 */
export async function requirePaidSubscription(): Promise<SubscriptionStatus> {
  const status = await getSubscriptionStatus();

  if (status.tier === "gratis") {
    throw new Error(
      "Du behöver en Guld- eller Premium-prenumeration för att göra detta. Uppgradera på /dashboard/billing."
    );
  }

  return status;
}
