import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, CalendarDays, Sparkles, Ticket } from "lucide-react";
import UschjaLogo from "@/components/UschjaLogo";
import { createClient } from "@/lib/supabase/server";
import { stockholmToday } from "@/lib/time";

/**
 * Länksidan i Instagram-bion: usha.se/insta.
 *
 * Instagram visar bara en länk i bion. I stället för att välja mellan The Lab
 * och plattformen leder den hit, och varje dörr spåras för sig (utm_campaign
 * per knapp, utm_content=bio) så att måndagsrapporten ser vad folk från
 * Instagram faktiskt vill ha. Värdena följer docs/utm-rutin.md i
 * usha-marknadsforing.
 *
 * Sidan är lika för alla utloggade och cachas på edge (CACHEABLE_PATHS).
 * Inget här får därför bero på vem som tittar.
 */

const THE_LAB_SERIES = "the-lab-torsdag";

const utm = (campaign: string) =>
  `utm_source=instagram&utm_medium=social&utm_campaign=${campaign}&utm_content=bio`;

// Inte exporterad: Next tillåter bara sina egna exporter från page.tsx.
const LINKS = {
  theLab: `/event/${THE_LAB_SERIES}?${utm("thelab")}`,
  calendar: `/kalender?${utm("kalender")}`,
  creators: `/for-kreatorer?${utm("kreator")}`,
  about: `/om?${utm("om")}`,
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("linkHub");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/insta" },
    // En länksida är ingen egen landningssida för sökmotorerna – innehållet finns på målsidorna.
    robots: { index: false, follow: true },
  };
}

async function nextTheLab(): Promise<{ date: string | null; price: number | null }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("event_date, price")
    .eq("series_slug", THE_LAB_SERIES)
    .eq("is_active", true)
    .eq("is_public", true)
    .gte("event_date", stockholmToday())
    .order("event_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  return { date: data?.event_date ?? null, price: data?.price ?? null };
}

export default async function InstaLinkPage() {
  const t = await getTranslations("linkHub");
  const locale = await getLocale();
  const lab = await nextTheLab();

  const labDate = lab.date
    ? new Intl.DateTimeFormat(locale === "sv" ? "sv-SE" : locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/Stockholm",
      }).format(new Date(`${lab.date}T12:00:00Z`))
    : null;

  const doors = [
    {
      href: LINKS.theLab,
      icon: Ticket,
      title: t("theLabTitle"),
      body: labDate ? t("theLabNext", { date: labDate }) : t("theLabBody"),
      meta: lab.price != null ? t("theLabMeta", { price: lab.price }) : t("theLabMetaNoPrice"),
      primary: true,
    },
    { href: LINKS.calendar, icon: CalendarDays, title: t("calendarTitle"), body: t("calendarBody"), primary: false },
    { href: LINKS.creators, icon: Sparkles, title: t("creatorsTitle"), body: t("creatorsBody"), primary: false },
  ];

  return (
    <main className="min-h-screen bg-[var(--usha-black)] px-5 pb-16 pt-14">
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <UschjaLogo size={72} />
        <h1 className="mt-5 text-2xl font-bold leading-tight">{t("title")}</h1>
        <p className="mt-2 text-sm text-[var(--usha-muted)]">{t("intro")}</p>

        <nav aria-label={t("navLabel")} className="mt-8 flex w-full flex-col gap-3">
          {doors.map((d) => (
            <Link
              key={d.href}
              href={d.href}
              className={
                d.primary
                  ? "group flex items-center gap-4 rounded-2xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] p-5 text-left text-black transition hover:opacity-90"
                  : "group flex items-center gap-4 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5 text-left transition hover:border-[var(--usha-gold)]/40"
              }
            >
              <d.icon size={24} className={d.primary ? "shrink-0" : "shrink-0 text-[var(--usha-gold)]"} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{d.title}</span>
                <span className={d.primary ? "block text-sm text-black/80" : "block text-sm text-[var(--usha-muted)]"}>
                  {d.body}
                </span>
                {"meta" in d && d.meta && <span className="mt-1 block text-xs font-medium text-black/70">{d.meta}</span>}
              </span>
              <ArrowRight size={18} className="shrink-0 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </nav>

        <Link href={LINKS.about} className="mt-8 text-sm text-[var(--usha-muted)] underline-offset-4 hover:underline">
          {t("about")}
        </Link>
      </div>
    </main>
  );
}
