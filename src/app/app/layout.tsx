export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { getLocale, getMessages } from "next-intl/server";
import { IntlProvider } from "@/components/intl-provider";
import { pickMessages, APP_NAMESPACES } from "@/lib/i18n/client-namespaces";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/mobile/app-shell";
import { SubscriptionProvider } from "@/lib/subscription/context";
import type { MemberTier, MemberRole } from "@/types/database";
import { normalizeRole } from "@/lib/roles";
import type { UserRole } from "@/components/mobile/role-context";

export const metadata = {
  title: "Usha Platform App",
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
    // Tillbaka till sidan efter inloggningen — en delad länk till ett pass
    // eller en kväll ska inte sluta på startsidan. /login rensar next själv.
    const { headers } = await import("next/headers");
    const path = (await headers()).get("x-usha-path") ?? "";
    redirect(path.startsWith("/app") ? `/login?next=${encodeURIComponent(path)}` : "/login");
  }

  // Konton som skapats med e-post eller BankID passerar aldrig /callback.
  // Första sidvisningen i appen sparar kanalen i stället (bara nya konton, en gång).
  {
    const { cookies } = await import("next/headers");
    const { recordSignupUtm } = await import("@/lib/analytics/signup-utm");
    const { UTM_COOKIE } = await import("@/lib/analytics/utm");
    await recordSignupUtm(user, (await cookies()).get(UTM_COOKIE)?.value);
  }

  let userName = user.email || "Användare";
  let tier: MemberTier = "gratis";
  let role: MemberRole = "customer";
  let plan: string | null = null;
  let hasActiveSubscription = false;
  // Rollen och admin-flaggan skickas in i AppShell så att menyerna renderas rätt
  // redan i serverrenderingen. Utan det startade rollkontexten på "customer" och
  // bytte meny under fingret efter hydrering.
  let initialRole: UserRole = "customer";

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, tier, role")
      .eq("id", user.id)
      .single();
    userName = profile?.full_name || user.email || "Användare";
    tier = (profile?.tier as MemberTier) ?? "gratis";
    role = (profile?.role as MemberRole) ?? "customer";
    initialRole = normalizeRole(profile?.role) ?? "customer";

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

  // Egen provider för den här delen: en nästlad NextIntlClientProvider
  // ERSÄTTER förälderns messages, den slår inte ihop dem. Rotlayouten bär bara
  // de publika sidornas namespace, så den här grenen måste bära sina egna.
  const messages = pickMessages(await getMessages(), APP_NAMESPACES);

  return (
    <IntlProvider locale={await getLocale()} messages={messages}>
      <SubscriptionProvider value={{ tier, role, hasActiveSubscription, plan }}>
        <AppShell userName={userName} initialRole={initialRole}>
          {children}
        </AppShell>
      </SubscriptionProvider>
    </IntlProvider>
  );
}
