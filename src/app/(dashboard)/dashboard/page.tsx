import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Calendar,
  CreditCard,
  BarChart3,
  Settings,
  List,
  Search,
  Clock,
  Wallet,
  Tag,
} from "lucide-react";
import Link from "next/link";
import { isAdmin } from "@/lib/admin/check";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const role = (profile?.role as string) ?? "customer";

  if (role === "customer") {
    return <CustomerDashboard profile={profile} />;
  }

  // Creator / Experience dashboard
  const [
    { data: subscription },
    { count: listingsCount },
    { count: bookingsCount },
    { count: completedCount },
    { data: completedBookings },
  ] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "active")
      .single(),
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .in("status", ["pending", "confirmed"]),
    supabase
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("status", "completed"),
    supabase
      .from("bookings")
      .select("listing_id, listings(price)")
      .eq("creator_id", user.id)
      .eq("status", "completed"),
  ]);

  const revenue = (completedBookings ?? []).reduce((sum, b: any) => {
    const price = b.listings?.price ?? 0;
    return sum + price;
  }, 0);

  const roleLabel = role === "creator" ? "Kreatör" : "Upplevelseföretag";

  return (
    <>
      <h1 className="mb-2 text-3xl font-bold">
        Hej, {profile?.full_name || roleLabel}! 👋
      </h1>
      <p className="mb-10 text-[var(--usha-muted)]">
        {subscription
          ? `Du har ${subscription.plan.includes('_') ? subscription.plan.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}-planen.`
          : "Du har Gratis-planen."}
      </p>

      {/* Quick stats */}
      <div className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Aktiva tjänster", value: String(listingsCount ?? 0), icon: List },
          { label: "Bokningar", value: String(bookingsCount ?? 0), icon: Calendar },
          { label: "Intäkter", value: `${revenue} SEK`, icon: CreditCard },
          { label: "Slutförda", value: String(completedCount ?? 0), icon: BarChart3 },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6"
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-[var(--usha-muted)]">
                {stat.label}
              </span>
              <stat.icon size={16} className="text-[var(--usha-muted)]" />
            </div>
            <p className="text-2xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/dashboard/listings/new"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <Calendar size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Ny tjänst</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Lägg till en ny tjänst eller klass
          </p>
        </Link>
        <Link
          href="/dashboard/listings"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <List size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Mina tjänster</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Visa och hantera dina tjänster
          </p>
        </Link>
        <Link
          href="/dashboard/profile"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <Settings size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Profilinställningar</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Anpassa din publika profil
          </p>
        </Link>
        <Link
          href="/dashboard/bookings"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <Calendar size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Bokningar</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Hantera inkommande och utgående bokningar
          </p>
        </Link>
        <Link
          href="/dashboard/analytics"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <BarChart3 size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Analytics</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Bokningar, intäkter och trender
          </p>
        </Link>
        <Link
          href="/dashboard/payouts"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <Wallet size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Utbetalningar</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Intäkter, kommission och uttag
          </p>
        </Link>
        <Link
          href="/dashboard/billing"
          className={`rounded-xl border p-6 transition-colors hover:bg-[var(--usha-card-hover)] ${
            subscription
              ? "border-[var(--usha-border)] bg-[var(--usha-card)] hover:border-[var(--usha-gold)]/30"
              : "border-[var(--usha-gold)]/30 bg-[var(--usha-card)]"
          }`}
        >
          <CreditCard size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">
            {subscription ? "Prenumeration" : "Uppgradera"}
          </h3>
          <p className="text-sm text-[var(--usha-muted)]">
            {subscription
              ? `${subscription.plan.includes('_') ? subscription.plan.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}-planen`
              : "Välj en plan för att låsa upp alla funktioner"}
          </p>
        </Link>
        {isAdmin(user.email) && (
          <Link
            href="/dashboard/admin/promo"
            className="rounded-xl border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/40"
          >
            <Tag size={20} className="mb-3 text-[var(--usha-gold)]" />
            <h3 className="mb-1 font-semibold">Promokoder</h3>
            <p className="text-sm text-[var(--usha-muted)]">
              Skapa och hantera rabattkoder
            </p>
          </Link>
        )}
      </div>
    </>
  );
}

function CustomerDashboard({ profile }: { profile: any }) {
  return (
    <>
      <h1 className="mb-2 text-3xl font-bold">
        Hej, {profile?.full_name || "du"}! 👋
      </h1>
      <p className="mb-10 text-[var(--usha-muted)]">
        Hitta och boka fantastiska upplevelser.
      </p>

      {/* Quick actions for customers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/app"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <Search size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Utforska</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Hitta kreatörer och upplevelser
          </p>
        </Link>
        <Link
          href="/dashboard/bookings"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <Clock size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Mina bokningar</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Se dina kommande och tidigare bokningar
          </p>
        </Link>
        <Link
          href="/dashboard/profile"
          className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition-colors hover:border-[var(--usha-gold)]/30"
        >
          <Settings size={20} className="mb-3 text-[var(--usha-gold)]" />
          <h3 className="mb-1 font-semibold">Profilinställningar</h3>
          <p className="text-sm text-[var(--usha-muted)]">
            Uppdatera dina uppgifter
          </p>
        </Link>
      </div>
    </>
  );
}
