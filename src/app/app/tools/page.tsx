import { createClient } from "@/lib/supabase/server";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LayoutGrid, ShieldCheck, Lock } from "lucide-react";
import { BETA_MODE } from "@/lib/beta";
import { isVenueRole } from "@/lib/roles";
import { venuesUserHasCapability } from "@/lib/venues/members";
import {
  groupedDestinationsFor,
  tierUnlocks,
  ADMIN_ROOT,
  type NavRole,
  type NavGroup,
} from "@/lib/navigation/registry";
import { adminAccessFor, hasAnyAdminAccess } from "@/lib/admin/capabilities";

export const dynamic = "force-dynamic";

export const metadata = { title: "Verktyg – Usha Platform" };

/** Gruppens rubriknyckel i toolsPage-namespacet. */
const GROUP_TITLE_KEY: Record<NavGroup, string> = {
  createSell: "groupCreateSell",
  finance: "groupFinance",
  explore: "groupExplore",
  myAccount: "groupMyAccount",
};

export default async function ToolsPage() {
  const t = await getTranslations("toolsPage");
  const tAdmin = await getTranslations("adminPage");

  // Listan kommer numera ur navigationsregistret i stället för en egen kopia
  // här. Sidomenyn på desktop läser samma register, så de kan inte längre
  // driva isär och göra en sida osynlig beroende på skärmbredd.
  let role: NavRole = "customer";
  let tier: string | null = null;
  let showAdmin = false;
  const extra: string[] = [];
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from("profiles").select("role, tier").eq("id", user.id).single();
      tier = (data?.tier as string) ?? null;
      const dbRole = (data?.role as string) ?? "customer";
      role = isVenueRole(dbRole) ? "venue" : dbRole === "creator" ? "creator" : "customer";
      showAdmin = hasAnyAdminAccess(await adminAccessFor(user.id));

      // Behörigheter kan låsa upp sidor som rollen inte ger. Den som sköter en
      // lokals sida ska hitta Förfrågningar även om det egna kontot har
      // besökarrollen — annars är behörigheten en kryssruta utan verkan.
      if ((await venuesUserHasCapability(user.id, "page")).length > 0) {
        extra.push("/app/venue-requests");
      }
    }
  } catch {
    // Faller tillbaka på kundvyn — hellre färre verktyg än en trasig sida.
  }

  const groups = groupedDestinationsFor(role, "more", extra);

  return (
    <div className="px-4 py-6">
      <div className="mb-6 flex items-center gap-2">
        <LayoutGrid size={22} className="text-[var(--usha-gold)]" />
        <h1 className="text-2xl font-bold">{t("heading")}</h1>
      </div>

      <div className="space-y-8">
        {groups.map(({ group, items }) => (
          <section key={group}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
              {t(GROUP_TITLE_KEY[group])}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {items.map((tool) => {
                // Låsta funktioner visas, inte göms: gråmarkerade med nivåns
                // namn. Länken går ändå till sidan, som förklarar och leder
                // vidare till uppgraderingen.
                const locked = !tierUnlocks(tier, tool.minTier, BETA_MODE);
                return (
                  <Link
                    key={tool.path}
                    href={tool.path}
                    aria-label={locked ? `${t(tool.labelKey!)} – ${t(tool.minTier === "premium" ? "lockedPremium" : "lockedGuld")}` : undefined}
                    className={`relative flex flex-col gap-2 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/50 ${locked ? "opacity-60 grayscale" : ""}`}
                  >
                    {locked && (
                      <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-[var(--usha-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
                        <Lock size={10} /> {t(tool.minTier === "premium" ? "lockedPremium" : "lockedGuld")}
                      </span>
                    )}
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                      <tool.icon size={20} />
                    </span>
                    <span className="font-semibold leading-tight text-[var(--usha-white)]">
                      {t(tool.labelKey!)}
                    </span>
                    {tool.descKey && (
                      <span className="text-xs text-[var(--usha-muted)]">{t(tool.descKey)}</span>
                    )}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        {/* Admin ligger utanför rollmodellen och därför utanför grupperna:
            det är is_admin som styr, inte creator/venue/customer. */}
        {showAdmin && (
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--usha-muted)]">
              {tAdmin("heading")}
            </h2>
            <Link
              href={ADMIN_ROOT}
              className="flex flex-col gap-2 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 transition hover:border-[var(--usha-gold)]/50 sm:max-w-xs"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--usha-gold)]/10 text-[var(--usha-gold)]">
                <ShieldCheck size={20} />
              </span>
              <span className="font-semibold leading-tight text-[var(--usha-white)]">
                {tAdmin("heading")}
              </span>
              <span className="text-xs text-[var(--usha-muted)]">{tAdmin("subheading")}</span>
            </Link>
          </section>
        )}
      </div>
    </div>
  );
}
