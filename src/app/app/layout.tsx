export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/mobile/app-shell";
import { SubscriptionProvider } from "@/lib/subscription/context";
import type { MemberTier, MemberRole } from "@/types/database";

export const metadata = {
  title: "Usha App",
  description: "Din kreativa plattform",
};

export default async function MobileAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth check — must be outside try/catch because redirect() throws
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  let userName = user.email || "Användare";
  let tier: MemberTier = "gratis";
  let role: MemberRole = "publik";
  let plan: string | null = null;
  let hasActiveSubscription = false;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, tier, role")
      .eq("id", user.id)
      .single();
    userName = profile?.full_name || user.email || "Användare";
    tier = (profile?.tier as MemberTier) ?? "gratis";
    role = (profile?.role as MemberRole) ?? "publik";

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan, status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .single();

    if (sub) {
      plan = sub.plan;
      hasActiveSubscription = true;
    }

    // During beta, all users have active subscription status (for feature access)
    const { BETA_MODE } = await import("@/lib/beta");
    if (BETA_MODE) {
      hasActiveSubscription = true;
    }
  } catch {
    // Continue with defaults if profile/subscription queries fail
  }

  return (
    <SubscriptionProvider value={{ tier, role, hasActiveSubscription, plan }}>
      <AppShell userName={userName}>
        {children}
      </AppShell>
    </SubscriptionProvider>
  );
}
