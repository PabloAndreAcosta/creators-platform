import { requireAdmin } from "@/lib/admin/guard";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { AdminNav } from "@/components/admin/admin-nav";
import { adminDestinationsFor } from "@/lib/navigation/registry";
import { Plus, Tag, Users, TrendingUp } from "lucide-react";
import { PromoTable } from "./promo-table";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function AdminPromoPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  const { created } = await searchParams;
  const access = await requireAdmin("promo");

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

  const t = await getTranslations("adminPromo");
  const codes = promoCodes || [];
  const activeCount = codes.filter((c: any) => c.is_active).length;

  return (
    <>
      {created && (
        <div className="mb-6 rounded-xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-medium text-green-400">
          {t("created")}
        </div>
      )}

      <AdminNav paths={adminDestinationsFor(access).map((d) => d.path)} />

      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{t("title")}</h1>
            <p className="mt-1 text-[var(--usha-muted)]">{t("intro")}</p>
          </div>
          <Link
            href="/dashboard/admin/promo/new"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90"
          >
            <Plus size={16} />
            {t("newCode")}
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-center gap-2 text-[var(--usha-muted)]">
            <Tag size={14} />
            <span className="text-xs">{t("statTotal")}</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{codes.length}</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <TrendingUp size={14} />
            <span className="text-xs">{t("statActive")}</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
          <div className="flex items-center gap-2 text-[var(--usha-gold)]">
            <Users size={14} />
            <span className="text-xs">{t("statUses")}</span>
          </div>
          <p className="mt-1 text-2xl font-bold">{totalUses ?? 0}</p>
        </div>
      </div>

      {/* Table */}
      <PromoTable promoCodes={codes} />
    </>
  );
}
