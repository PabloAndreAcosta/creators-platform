import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { UserPlus, Ticket, Gift, ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/landing/site-nav";
import { PerspectiveLinks } from "@/components/landing/perspective-links";
import { Footer } from "@/components/landing/footer";
import { PerkList, PerkProviderInvite } from "@/components/perks/perk-list";
import { getCurrentUser } from "@/lib/supabase/current-user";
import { isPerkEligible } from "@/lib/perks/eligibility";
import { loadPerkOffers } from "@/lib/perks/load";
import { languageAlternates } from "@/lib/seo/metadata";

/**
 * Förmånssidan, publik. Förklarar förmånerna och visar dem låsta för den som
 * inte är inloggad; koderna finns bara i appen (/app/formaner).
 *
 * Byggd före den första leverantören (beslut Pablo 2026-11-25): med noll
 * förmåner visas ett tomt läge, sidan göms inte. Texten lovar inga namngivna
 * leverantörer och inga resor eller boende.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("perks");
  const title = t("meta.title");
  const description = t("meta.description");
  return {
    title,
    description,
    alternates: { canonical: "/formaner", languages: languageAlternates("/formaner") },
    openGraph: { title, description, url: "https://usha.se/formaner", type: "website", locale: "sv_SE", siteName: "Usha Platform" },
  };
}

export default async function PerksPage() {
  const [t, locale, user] = await Promise.all([getTranslations("perks"), getLocale(), getCurrentUser()]);
  const eligible = isPerkEligible(user);
  // Den publika sidan visar aldrig koden, inte ens för den som är inloggad:
  // den kan vara cachad eller delad. Koden hämtas i appen.
  const offers = await loadPerkOffers(false);
  const lockedHref = eligible ? "/app/formaner" : "/login?next=/app/formaner";

  const steps = [
    { icon: UserPlus, title: t("how.s1Title"), body: t("how.s1Body") },
    { icon: Gift, title: t("how.s2Title"), body: t("how.s2Body") },
    { icon: Ticket, title: t("how.s3Title"), body: t("how.s3Body") },
  ];

  return (
    <main>
      <SiteNav />
      <section className="px-4 pb-8 pt-28 sm:px-6 sm:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--usha-gold)]">{t("hero.eyebrow")}</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-5xl">{t("hero.title")}</h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-[var(--usha-muted)]">{t("hero.body")}</p>
          <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {eligible ? (
              <a
                href="/app/formaner"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90"
              >
                {t("hero.ctaApp")} <ArrowRight size={16} />
              </a>
            ) : (
              <>
                <a
                  href="/signup?next=/app/formaner"
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-6 py-3 text-sm font-bold text-black transition hover:opacity-90"
                >
                  {t("hero.ctaSignup")} <ArrowRight size={16} />
                </a>
                <a
                  href="/login?next=/app/formaner"
                  className="inline-flex items-center gap-2 rounded-xl border border-[var(--usha-border)] px-6 py-3 text-sm font-semibold transition hover:border-[var(--usha-gold)]/40"
                >
                  {t("hero.ctaLogin")}
                </a>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl">{t("how.title")}</h2>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {steps.map((s, i) => (
              <li key={i} className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                  <s.icon size={18} className="text-[var(--usha-gold)]" />
                </div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-[var(--usha-muted)]">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-6 text-center text-2xl font-bold tracking-tight sm:text-3xl">{t("listTitle")}</h2>
          <PerkList offers={offers} locale={locale} lockedHref={lockedHref} />
          <p className="mx-auto mt-6 max-w-2xl text-center text-xs leading-relaxed text-[var(--usha-muted)]">{t("finePrint")}</p>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-3xl">
          <PerkProviderInvite />
        </div>
      </section>

      <PerspectiveLinks />
      <Footer />
    </main>
  );
}
