import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { getTranslations } from "next-intl/server";
import PayoutDashboard from "@/components/dashboard/PayoutDashboard";
import ConnectButton from "../billing/connect-button";

export default async function PayoutsPage() {
  const t = await getTranslations("payouts");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Only creators/experience can view payouts
  // stripe_account_id är kolumn-låst för authenticated — läs egen rad via
  // service-role efter getUser()-ägarkontrollen ovan.
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("role, stripe_account_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "customer";

  if (role === "customer") {
    redirect("/dashboard");
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-[var(--usha-white)]"
        >
          <ArrowLeft size={14} />
          {t("back")}
        </Link>
        <div className="flex items-center gap-3">
          <Wallet size={24} className="text-[var(--usha-gold)]" />
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-[var(--usha-muted)]">
              {t("subtitle")}
            </p>
          </div>
        </div>
      </div>

      {/* Getting paid is set up here, on the page called Payouts.
          It used to sit at the bottom of the subscription page, so the
          onboarding step about payouts opened a page about plans — and the card
          was several screens below the fold. The task and the page it lives on
          now have the same subject. */}
      <div id="stripe" className="mb-8 scroll-mt-20">
        <ConnectButton />
      </div>

      {profile?.stripe_account_id && <PayoutDashboard creatorId={user.id} />}
    </>
  );
}
