import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Award, BadgeCheck, CalendarDays, GraduationCap, MapPin, Search, Ticket, Wallet } from "lucide-react";
import { SiteNav } from "@/components/landing/site-nav";
import { Footer } from "@/components/landing/footer";
import { createClient } from "@/lib/supabase/server";
import { indexable } from "@/lib/seo/metadata";
import {
  COACHING_FORMATS,
  instructorHref,
  matchesInstructor,
  type CoachingFormat,
  type InstructorRow,
} from "@/lib/coaching/instructors";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("instruktorerPage");
  return {
    title: t("meta.title"),
    description: t("meta.description"),
    ...indexable("/instruktorer"),
    openGraph: {
      title: t("meta.title"),
      description: t("meta.description"),
      url: "https://usha.se/instruktorer",
      type: "website",
      siteName: "Usha Platform",
    },
  };
}

interface Props {
  searchParams: Promise<{ q?: string; stad?: string; sprak?: string; format?: string; maxpris?: string }>;
}

export default async function InstructorsPage(props: Props) {
  const t = await getTranslations("instruktorerPage");
  const params = await props.searchParams;
  const filter = {
    q: params.q?.trim() || "",
    city: params.stad?.trim() || "",
    language: params.sprak?.trim() || "",
    format: ((COACHING_FORMATS as readonly string[]).includes(params.format ?? "") ? params.format : "") as CoachingFormat | "",
    maxRate: params.maxpris && Number(params.maxpris) > 0 ? Number(params.maxpris) : null,
  };
  const filtered = !!(filter.q || filter.city || filter.language || filter.format || filter.maxRate);

  const supabase = await createClient();
  const [{ data: rows }, { data: auth }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, slug, full_name, avatar_url, coaching_title, coaching_bio, coaching_hourly_rate_sek, coaching_specialties, coaching_formats, coaching_credentials, dance_styles, dance_languages, locations, location"
      )
      .eq("is_public", true)
      .eq("offers_coaching", true)
      .eq("role", "creator")
      .order("updated_at", { ascending: false })
      .limit(300),
    supabase.auth.getUser(),
  ]);
  const instructors = ((rows ?? []) as InstructorRow[]).filter((r) => matchesInstructor(r, filter));

  // Inloggad kreatör går direkt till profilens instruktörsdel; övriga skapar
  // ett kreatörskonto och landar där efteråt.
  const becomeHref = auth.user ? "/dashboard/profile#instruktor" : "/signup?role=creator&next=/dashboard/profile";
  const input =
    "min-h-[44px] w-full rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] px-3 py-2 text-base outline-none transition focus:border-[var(--usha-gold)]/40 sm:text-sm";

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <SiteNav />

      {/* Hero */}
      <section className="border-b border-[var(--usha-border)]">
        <div className="mx-auto max-w-5xl px-6 pb-16 pt-28 text-center sm:pb-20 sm:pt-32">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
            <GraduationCap size={28} className="text-[var(--usha-gold)]" />
          </div>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
            {t("hero.titleLead")} <span className="text-gradient">{t("hero.titleHighlight")}</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-[var(--usha-muted)] sm:text-lg">{t("hero.body")}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#katalog"
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90"
            >
              {t("hero.ctaFind")}
            </a>
            <Link
              href={becomeHref}
              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-[var(--usha-border)] px-8 py-3 text-sm font-medium text-[var(--usha-white)] transition hover:border-[var(--usha-gold)]/40"
            >
              {t("hero.ctaBecome")}
            </Link>
          </div>
        </div>
      </section>

      {/* Katalogen */}
      <section id="katalog" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold sm:text-3xl">{t("directory.heading")}</h2>
        <form method="get" action="/instruktorer#katalog" className="mt-6 grid gap-3 sm:grid-cols-6">
          <label className="sm:col-span-2">
            <span className="sr-only">{t("directory.q")}</span>
            <input name="q" defaultValue={filter.q} placeholder={t("directory.qPlaceholder")} className={input} />
          </label>
          <label>
            <span className="sr-only">{t("directory.city")}</span>
            <input name="stad" defaultValue={filter.city} placeholder={t("directory.city")} className={input} />
          </label>
          <label>
            <span className="sr-only">{t("directory.language")}</span>
            <input name="sprak" defaultValue={filter.language} placeholder={t("directory.language")} className={input} />
          </label>
          <label>
            <span className="sr-only">{t("directory.format")}</span>
            <select name="format" defaultValue={filter.format} className={input}>
              <option value="">{t("directory.formatAny")}</option>
              {COACHING_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {t(`formats.${f}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">{t("directory.maxRate")}</span>
            <input
              name="maxpris"
              type="number"
              min={0}
              step={50}
              defaultValue={filter.maxRate ?? ""}
              placeholder={t("directory.maxRate")}
              className={input}
            />
          </label>
          <div className="flex gap-3 sm:col-span-6">
            <button className="flex min-h-[44px] items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-5 text-sm font-bold text-black">
              <Search size={16} />
              {t("directory.search")}
            </button>
            {filtered && (
              <Link href="/instruktorer#katalog" className="flex min-h-[44px] items-center text-sm text-[var(--usha-muted)] underline">
                {t("directory.clear")}
              </Link>
            )}
          </div>
        </form>

        {instructors.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-8 text-center text-sm text-[var(--usha-muted)]">
            <p>{filtered ? t("directory.noMatch") : t("directory.empty")}</p>
            <Link href={becomeHref} className="mt-3 inline-block font-semibold text-[var(--usha-gold)] hover:underline">
              {t("hero.ctaBecome")}
            </Link>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {instructors.map((r) => {
              const cities = r.locations?.length ? r.locations : r.location ? [r.location] : [];
              const tags = [...(r.coaching_specialties ?? []), ...(r.dance_styles ?? [])].slice(0, 5);
              return (
                <li key={r.id}>
                  <Link
                    href={instructorHref(r)}
                    className="flex h-full gap-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 transition hover:border-[var(--usha-gold)]/40"
                  >
                    {r.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- profilbilder kommer från flera domäner (Google, Instagram …)
                      <img src={r.avatar_url} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" loading="lazy" />
                    ) : (
                      <div className="h-14 w-14 shrink-0 rounded-full bg-[var(--usha-border)]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{r.full_name}</p>
                      <p className="text-sm text-[var(--usha-gold)]">
                        {r.coaching_title || t("defaultTitle")}
                        {(r.coaching_credentials?.length ?? 0) > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-[var(--usha-gold)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            <Award size={10} />
                            {t("credentialsBadge", { n: r.coaching_credentials!.length })}
                          </span>
                        )}
                      </p>
                      {tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span key={tag} className="rounded-full border border-[var(--usha-border)] px-2 py-0.5 text-xs text-[var(--usha-muted)]">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--usha-muted)]">
                        {cities.length > 0 && (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} />
                            {cities.join(", ")}
                          </span>
                        )}
                        {(r.coaching_formats ?? []).map((f) => (
                          <span key={f}>{t(`formats.${f as CoachingFormat}`)}</span>
                        ))}
                        {r.coaching_hourly_rate_sek != null && (
                          <span className="font-medium text-[var(--usha-white)]">
                            {t("rate", { price: r.coaching_hourly_rate_sek })}
                          </span>
                        )}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Vad plattformen ger instruktören */}
      <section className="border-t border-[var(--usha-border)] bg-[var(--usha-card)]/30">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-bold sm:text-3xl">{t("offer.heading")}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-[var(--usha-muted)]">{t("offer.body")}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={<CalendarDays size={18} />} title={t("offer.lessonsTitle")} body={t("offer.lessonsBody")} />
            <Feature icon={<Ticket size={18} />} title={t("offer.eventsTitle")} body={t("offer.eventsBody")} />
            <Feature icon={<GraduationCap size={18} />} title={t("offer.passTitle")} body={t("offer.passBody")} />
            <Feature icon={<MapPin size={18} />} title={t("offer.openNightsTitle")} body={t("offer.openNightsBody")} />
            <Feature icon={<Wallet size={18} />} title={t("offer.paidTitle")} body={t("offer.paidBody")} />
            <Feature icon={<BadgeCheck size={18} />} title={t("offer.trustTitle")} body={t("offer.trustBody")} />
          </div>

          <h2 className="mt-16 text-center text-2xl font-bold sm:text-3xl">{t("steps.heading")}</h2>
          <ol className="mx-auto mt-8 max-w-2xl space-y-3 text-sm text-[var(--usha-muted)]">
            {(["1", "2", "3", "4"] as const).map((n) => (
              <li key={n} className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--usha-gold)]/10 text-xs font-bold text-[var(--usha-gold)]">
                  {n}
                </span>
                <span>{t(`steps.s${n}`)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-10 text-center">
            <Link
              href={becomeHref}
              className="inline-flex min-h-[48px] items-center justify-center rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90"
            >
              {t("hero.ctaBecome")}
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
      <div className="mb-2 flex items-center gap-2 text-[var(--usha-gold)]">
        {icon}
        <span className="text-sm font-semibold text-[var(--usha-white)]">{title}</span>
      </div>
      <p className="text-xs text-[var(--usha-muted)]">{body}</p>
    </div>
  );
}
