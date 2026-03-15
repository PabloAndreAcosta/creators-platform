import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getPlanList, GRATIS_PLAN } from "@/lib/stripe/config";
import Link from "next/link";
import { ArrowLeft, Check } from "lucide-react";
import { CheckoutButton, PortalButton } from "./checkout-button";
import type { MemberRole } from "@/types/database";
import CreatorTierInfo from "@/components/dashboard/CreatorTierInfo";
import ConnectButton from "./connect-button";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string }>;
}) {
  const { success } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, tier")
    .eq("id", user.id)
    .single();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .in("status", ["active", "trialing", "past_due"])
    .single();

  const currentPlan = subscription?.plan ?? null;
  const userRole = (profile?.role as MemberRole) ?? "publik";
  const userTier = (profile?.tier as 'gratis' | 'guld' | 'premium') ?? 'gratis';
  const isCreatorRole = userRole === "kreator" || userRole === "upplevelse";

  // Fetch monthly earnings for creator tier info
  let monthlyEarnings = 0;
  if (isCreatorRole) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: completedBookings } = await supabase
      .from("bookings")
      .select("listing_id, listings(price)")
      .eq("creator_id", user.id)
      .eq("status", "completed")
      .gte("updated_at", startOfMonth.toISOString());

    monthlyEarnings = (completedBookings ?? []).reduce((sum, b: any) => {
      return sum + (b.listings?.price ?? 0);
    }, 0);
  }

  // Get plans for user's role
  const rolePlans = getPlanList(userRole);

  // Plan name for display
  const currentPlanDisplay = currentPlan
    ? currentPlan.includes("_")
      ? currentPlan.split("_").map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
      : currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)
    : "Gratis";

  return (
    <>
      {success && (
        <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-400">
          Betalningen lyckades! Din plan är nu aktiv.
        </div>
      )}

      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <h1 className="text-3xl font-bold">Prenumeration</h1>
        <p className="mt-1 text-[var(--usha-muted)]">
          Hantera din plan och betalningar.
        </p>
      </div>

      {/* Current plan status */}
      {subscription && (
        <div className="mb-8 rounded-2xl border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-[var(--usha-muted)]">Nuvarande plan</p>
              <p className="text-xl font-bold">{currentPlanDisplay}</p>
              <div className="mt-1 flex items-center gap-3 text-sm text-[var(--usha-muted)]">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                    subscription.status === "active"
                      ? "bg-green-500/10 text-green-400"
                      : subscription.status === "trialing"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {subscription.status === "active"
                    ? "Aktiv"
                    : subscription.status === "trialing"
                      ? "Provperiod"
                      : "Förfallen"}
                </span>
                {subscription.current_period_end && (
                  <span>
                    Förnyas{" "}
                    {new Date(
                      subscription.current_period_end
                    ).toLocaleDateString("sv-SE")}
                  </span>
                )}
              </div>
            </div>
            <PortalButton />
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Gratis plan card */}
        <div
          className={`relative rounded-2xl border p-8 transition-all ${
            !currentPlan || currentPlan === "gratis"
              ? "border-[var(--usha-gold)]/40 bg-[var(--usha-card)]"
              : "border-[var(--usha-border)] bg-[var(--usha-card)]"
          }`}
        >
          <h3 className="text-xl font-bold">{GRATIS_PLAN.name}</h3>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">
            {GRATIS_PLAN.description}
          </p>

          <div className="my-6 flex items-baseline gap-1">
            <span className="text-4xl font-extrabold">0</span>
            <span className="text-[var(--usha-muted)]">SEK/mån</span>
          </div>

          <ul className="mb-8 space-y-3">
            {GRATIS_PLAN.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check
                  size={14}
                  className="mt-0.5 shrink-0 text-[var(--usha-gold)]"
                />
                <span className="text-[var(--usha-muted)]">{f}</span>
              </li>
            ))}
          </ul>

          {!currentPlan || currentPlan === "gratis" ? (
            <div className="block w-full rounded-xl border border-[var(--usha-gold)]/30 py-3 text-center text-sm font-semibold text-[var(--usha-gold)]">
              Nuvarande plan
            </div>
          ) : (
            <div className="block w-full rounded-xl border border-[var(--usha-border)] py-3 text-center text-sm font-semibold text-[var(--usha-muted)]">
              Gratis
            </div>
          )}
        </div>

        {/* Paid plan cards for user's role */}
        {rolePlans.map((plan) => {
          const isCurrent = currentPlan === plan.key;

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border p-8 transition-all ${
                plan.popular
                  ? "border-[var(--usha-gold)]/40 bg-[var(--usha-card)] glow-gold scale-[1.02]"
                  : "border-[var(--usha-border)] bg-[var(--usha-card)]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-1 text-xs font-bold text-black">
                  Populärast
                </div>
              )}

              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-[var(--usha-muted)]">
                {plan.description}
              </p>

              <div className="my-6 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold">{plan.price}</span>
                <span className="text-[var(--usha-muted)]">SEK/mån</span>
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--usha-gold)]"
                    />
                    <span className="text-[var(--usha-muted)]">{f}</span>
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="block w-full rounded-xl border border-[var(--usha-gold)]/30 py-3 text-center text-sm font-semibold text-[var(--usha-gold)]">
                  Nuvarande plan
                </div>
              ) : (
                <CheckoutButton
                  planKey={plan.key}
                  label={currentPlan ? `Byt till ${plan.name}` : `Starta ${plan.name}`}
                  popular={plan.popular}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Stripe Connect for creators */}
      {isCreatorRole && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-bold">Utbetalningar</h2>
          <ConnectButton />
        </div>
      )}

      {/* Creator tier info section */}
      {isCreatorRole && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-bold">Din kommissionsnivå</h2>
          <CreatorTierInfo
            creatorTier={userTier}
            creatorEarningsThisMonth={monthlyEarnings}
          />
        </div>
      )}
    </>
  );
}
