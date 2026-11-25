import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Gift, Lock } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { isPerkEligible } from "@/lib/perks/eligibility";
import { loadPerkOffers } from "@/lib/perks/load";
import { PerkList, PerkProviderInvite } from "@/components/perks/perk-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("perks");
  return { title: t("app.metaTitle") };
}

// Förmånerna i appen: samma lista som /formaner, men med koden för den som är
// behörig. Behörigheten avgörs bara av isPerkEligible.
export default async function AppPerksPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app/formaner");

  const [t, locale] = await Promise.all([getTranslations("perks"), getLocale()]);
  const eligible = isPerkEligible(user);
  const offers = await loadPerkOffers(eligible);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <Gift size={22} className="text-[var(--usha-gold)]" />
        {t("app.title")}
      </h1>
      <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("app.intro")}</p>

      {!eligible && (
        <p className="mt-4 flex items-center gap-2 rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 text-sm">
          <Lock size={16} className="shrink-0 text-[var(--usha-muted)]" /> {t("app.notEligible")}
        </p>
      )}

      <div className="mt-6">
        <PerkList offers={offers} locale={locale} lockedHref="/formaner" />
      </div>
      {offers.length > 0 && <p className="mt-4 text-xs text-[var(--usha-muted)]">{t("app.howToUse")}</p>}
      <p className="mt-4 text-xs leading-relaxed text-[var(--usha-muted)]">{t("finePrint")}</p>

      <div className="mt-8">
        <PerkProviderInvite />
      </div>
    </div>
  );
}
