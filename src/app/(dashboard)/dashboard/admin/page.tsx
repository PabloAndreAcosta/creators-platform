import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { requireAnyAdmin } from "@/lib/admin/guard";
import { adminDestinationsFor } from "@/lib/navigation/registry";
import { AdminNav } from "@/components/admin/admin-nav";

export const dynamic = "force-dynamic";

// No `metadata` export on purpose. Next evaluates it before the page function
// runs, so a static title is sent even to someone the guard below turns away —
// verified against production: a non-admin got no page content but did get
// "Admin – Usha Platform" in the tab. It leaks nothing but the route's
// existence, and the sibling admin pages export none either.

/**
 * The admin hub. The tools existed before this page did, reachable only by
 * typing their URLs — which meant they were easy to forget and impossible to
 * discover. The list comes from the navigation registry, so a new admin tool
 * shows up here the moment it is declared.
 */
export default async function AdminHubPage() {
  const access = await requireAnyAdmin();
  const tools = adminDestinationsFor(access);
  const t = await getTranslations("adminPage");

  return (
    <div className="px-4 py-6 md:max-w-2xl md:mx-auto">
      <AdminNav paths={tools.map((d) => d.path)} />

      <div className="mb-6 flex items-center gap-2">
        <ShieldCheck size={22} className="text-[var(--usha-gold)]" />
        <div>
          <h1 className="text-2xl font-bold">{t("heading")}</h1>
          <p className="text-xs text-[var(--usha-muted)]">{t("subheading")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link
            key={tool.path}
            href={tool.path}
            className="flex flex-col gap-2 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
              <tool.icon size={20} />
            </span>
            <span className="font-semibold leading-tight text-[var(--usha-white)]">
              {t(tool.labelKey)}
            </span>
            <span className="text-xs leading-snug text-[var(--usha-muted)]">
              {t(tool.descKey)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
