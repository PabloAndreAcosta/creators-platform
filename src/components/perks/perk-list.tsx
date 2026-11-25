import { useTranslations } from "next-intl";
import { Gift, Lock, MapPin, ArrowRight, Mail, Store } from "lucide-react";
import { pickText } from "@/lib/perks/catalog";
import type { PerkOffer } from "@/lib/perks/offers";

/**
 * Förmånslistan, delad mellan den publika sidan (/formaner) och appen
 * (/app/formaner). Serverkomponent: koden finns bara i offer.code när servern
 * redan bedömt kontot som behörigt.
 *
 * Låst men synligt: den som inte är behörig ser förmånen, med ett lås och en
 * väg in, aldrig en gömd rad (feedback_lasta_funktioner_synliga).
 */
export function PerkList({
  offers,
  locale,
  lockedHref,
}: {
  offers: PerkOffer[];
  locale: string;
  /** Vart låset leder den som inte är behörig. */
  lockedHref: string;
}) {
  const t = useTranslations("perks");
  if (offers.length === 0) return <PerkEmpty />;
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {offers.map(({ perk, kind, priceKr, code }) => (
        <li key={perk.id} className="flex flex-col rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--usha-muted)]">
                {t(`categories.${perk.category}`)}
              </p>
              <h3 className="mt-1 font-semibold">{pickText(perk.title, locale)}</h3>
              <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--usha-muted)]">
                <MapPin size={12} /> {perk.provider}, {perk.city}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--usha-gold)]/15 px-3 py-1 text-xs font-bold text-[var(--usha-gold)]">
              {kind === "free" ? t("free") : t("discount", { price: priceKr ?? 0 })}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-[var(--usha-muted)]">{pickText(perk.description, locale)}</p>
          {perk.terms && <p className="mt-2 text-xs leading-relaxed text-[var(--usha-muted)]">{pickText(perk.terms, locale)}</p>}
          <div className="mt-auto pt-4">
            {code ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-lg border border-dashed border-[var(--usha-gold)]/50 px-3 py-1.5 font-mono text-sm font-bold tracking-wider">
                  {code}
                </span>
                <a
                  href={`/series/${encodeURIComponent(perk.seriesSlug)}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--usha-gold)] hover:underline"
                >
                  {t("bookWithCode")} <ArrowRight size={14} />
                </a>
              </div>
            ) : (
              <a
                href={lockedHref}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--usha-muted)] hover:text-[var(--usha-gold)]"
              >
                <Lock size={14} /> {t("locked")}
              </a>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Inga förmåner än: säg vad det är och att de kommer. Göms aldrig. */
export function PerkEmpty() {
  const t = useTranslations("perks.empty");
  return (
    <div className="rounded-2xl border border-dashed border-[var(--usha-border)] bg-[var(--usha-card)] p-6 text-center sm:p-8">
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
        <Gift size={20} className="text-[var(--usha-gold)]" />
      </div>
      <h3 className="font-semibold">{t("title")}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--usha-muted)]">{t("body")}</p>
    </div>
  );
}

/** Kort ingång till /formaner från /for-publik. */
export function PerksTeaser() {
  const t = useTranslations("perks.teaser");
  return (
    <section className="px-4 py-10 sm:px-6 sm:py-14">
      <a
        href="/formaner"
        className="mx-auto flex max-w-3xl items-center gap-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 transition hover:border-[var(--usha-gold)]/40 sm:p-6"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
          <Gift size={20} className="text-[var(--usha-gold)]" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm leading-relaxed text-[var(--usha-muted)]">{t("body")}</p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-[var(--usha-gold)]" />
      </a>
    </section>
  );
}

export const PERKS_CONTACT_EMAIL = "support@usha.se";

/** Till leverantörerna: vägen in. */
export function PerkProviderInvite() {
  const t = useTranslations("perks.providers");
  return (
    <div className="rounded-2xl border border-[var(--usha-border)] bg-gradient-to-br from-[var(--usha-gold)]/5 to-[var(--usha-accent)]/5 p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--usha-gold)]">{t("eyebrow")}</p>
      <h2 className="mt-2 text-xl font-bold sm:text-2xl">{t("title")}</h2>
      <p className="mt-3 text-sm leading-relaxed text-[var(--usha-muted)] sm:text-base">{t("body")}</p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <a
          href="/for-platser"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] px-5 py-2.5 text-sm font-semibold transition hover:border-[var(--usha-gold)]/40"
        >
          <Store size={16} /> {t("forVenues")}
        </a>
        <a
          href={`mailto:${PERKS_CONTACT_EMAIL}?subject=${encodeURIComponent(t("mailSubject"))}`}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] px-5 py-2.5 text-sm font-semibold transition hover:border-[var(--usha-gold)]/40"
        >
          <Mail size={16} /> {PERKS_CONTACT_EMAIL}
        </a>
      </div>
    </div>
  );
}
