import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import PayoutDashboard from "@/components/dashboard/PayoutDashboard";

export default async function PayoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Only creators/experience can view payouts
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, stripe_account_id")
    .eq("id", user.id)
    .single();

  const role = profile?.role ?? "publik";

  if (role === "publik") {
    redirect("/dashboard");
  }

  return (
    <>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} />
          Tillbaka
        </Link>
        <div className="flex items-center gap-3">
          <Wallet size={24} className="text-[var(--usha-gold)]" />
          <div>
            <h1 className="text-3xl font-bold">Utbetalningar</h1>
            <p className="mt-1 text-[var(--usha-muted)]">
              Överblick över intäkter, kommission och utbetalningshistorik.
            </p>
          </div>
        </div>
      </div>

      {!profile?.stripe_account_id ? (
        <div className="rounded-2xl border border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] p-10 text-center">
          <Wallet size={40} className="mx-auto mb-4 text-[var(--usha-muted)]" />
          <h2 className="mb-2 text-lg font-semibold">Inget Stripe-konto anslutet</h2>
          <p className="mb-6 text-sm text-[var(--usha-muted)]">
            Du behöver ansluta ett Stripe-konto för att ta emot utbetalningar.
          </p>
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--usha-gold)] px-6 py-3 text-sm font-semibold text-black transition hover:opacity-90"
          >
            Anslut Stripe-konto
          </Link>
        </div>
      ) : (
        <PayoutDashboard creatorId={user.id} />
      )}
    </>
  );
}
