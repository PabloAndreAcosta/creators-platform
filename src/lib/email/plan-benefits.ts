import { getServerTranslator } from "@/lib/i18n/server";
import { PLANS, type PlanKey } from "@/lib/stripe/config";
import type { Locale } from "@/i18n/config";

/**
 * Förmånerna för en nivå, på mottagarens språk.
 *
 * VARFÖR DE HÄMTAS FRÅN LANDNINGSSIDANS NYCKLAR. Nivåernas förmåner stod
 * tidigare på tre ställen: `PLANS.features` i koden, `landing.pricing.*` i
 * i18n och en egen hårdkodad lista i välkomstmejlet. Mejlets lista var kvar
 * från Publik Guld och räknade upp rabatt, förtur, prioritetskö och
 * prioriterad support — ingen av dem gäller en kreatör, och två av dem finns
 * inte alls. En kreatör som köpte Guld fick alltså ett mejl om något annat än
 * det hen betalat för.
 *
 * Nu finns texten på ETT ställe per språk, och testet nedanför kräver att den
 * listan är lika lång som `PLANS[...].features`. Läggs en förmån till i koden
 * faller testet tills sidan och mejlet följt med.
 */
const BENEFIT_KEYS: Partial<Record<PlanKey, readonly string[]>> = {
  kreator_guld: [
    "kreatorGold1",
    "kreatorGold2",
    "kreatorGold3",
    "kreatorGold4",
    "kreatorGold5",
    "kreatorGold6",
  ],
  kreator_premium: [
    "kreatorPremium1",
    "kreatorPremium2",
    "kreatorPremium3",
    "kreatorPremium4",
    "kreatorPremium5",
    "kreatorPremium6",
  ],
};

/** i18n-nycklarna för en nivå. Exporterad för testet. */
export function benefitKeys(planKey: string): readonly string[] {
  return BENEFIT_KEYS[planKey as PlanKey] ?? [];
}

export async function planBenefits(planKey: string, locale: Locale): Promise<string[]> {
  const keys = benefitKeys(planKey);
  if (keys.length === 0) return [];
  const t = await getServerTranslator("landing", locale);
  return keys.map((k) => t(`pricing.${k}`));
}

/** Nivåns namn så mejlet kan säga "Guld" eller "Premium" i stället för att gissa. */
export function planName(planKey: string): string {
  return PLANS[planKey as PlanKey]?.name ?? "";
}
