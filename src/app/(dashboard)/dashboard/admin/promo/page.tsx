import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/check";
import Link from "next/link";
import { ArrowLeft, Plus, Tag, Users, TrendingUp } from "lucide-react";
import { PromoTable } from "./promo-table";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPromoPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdmin(user.email)) {
    redirect("/dashboard");
  }

  // Use admin client to bypass RLS for full access
  const admin = createAdminClient();

  const { data: promoCodes } = await admin
    .from("promo_codes")
    .select("*")
    .order("created_at", { ascending: false });

  // Get usage stats
  const { count: totalUses } = await admin
    .from("promo_code_uses")
    .select("id", { count: "exact", head: true });

  const codes = promoCodes || [];
  const activeCount = codes.filter((c: any) => c.is_active).length;

  return (
    <>
      {created && (
        <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-400">
          Promokod skapad!
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Promokoder</h1>
            <p className="mt-1 text-[var(--usha-muted)]">
              Skapa och hantera rabattkoder.
            </p>
          </div>
          <Link
            href="/dashboard/admin/promo/new"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <Plus size={16} />
            Ny promokod
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-center gap-2 text-[var(--usha-muted)]">
            <Tag size={14} />
            <span className="text-xs">Totalt</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{codes.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <TrendingUp size={14} />
            <span className="text-xs">Aktiva</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-center gap-2 text-[var(--usha-gold)]">
            <Users size={14} />
            <span className="text-xs">Användningar</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{totalUses ?? 0}</p>
        </div>
      </div>

      {/* Table */}
      <PromoTable promoCodes={codes} />
    </>
  );
}
