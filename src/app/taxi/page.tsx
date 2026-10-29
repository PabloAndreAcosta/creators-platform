import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { HeartHandshake, UserPlus } from "lucide-react";
import { SiteNav } from "@/components/landing/site-nav";
import { Footer } from "@/components/landing/footer";
import { createClient } from "@/lib/supabase/server";
import { loadUpcomingEvenings } from "@/lib/taxi/data";
import { stockholmToday } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("taxiPass");
  return {
    title: t("landingMetaTitle"),
    description: t("landingMetaDescription"),
    alternates: { canonical: "/taxi" },
    openGraph: {
      title: t("landingMetaTitle"),
      description: t("landingMetaDescription"),
      url: "https://usha.se/taxi",
      type: "website",
      siteName: "Usha Platform",
    },
  };
}

const time = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/**
 * Den öppna sidan om taxipassen — dit länken i inläggen pekar.
 *
 * Allt under /app kräver inloggning och skickar annars till en tom
 * inloggningssida. Den som kommer från Instagram ska i stället få veta vad
 * passen är och exakt vilket konto som behövs: ett gratis Publik-konto. Knappen
 * förväljer den rollen och leder tillbaka till passen efter registreringen.
 */
export default async function TaxiLandingPage() {
  const t = await getTranslations("taxiPass");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const evenings = await loadUpcomingEvenings(stockholmToday());

  // Utloggade skickas via registreringen; den som redan har konto går rakt in.
  const to = (path: string) => (user ? path : `/signup?role=customer&next=${encodeURIComponent(path)}`);
  const gold =
    "flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3 text-sm font-bold text-black transition hover:opacity-90";

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
          <HeartHandshake size={28} className="text-[var(--usha-gold)]" />
        </div>
        <h1 className="text-center text-4xl font-bold leading-tight">{t("landingTitle")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--usha-muted)]">{t("landingIntro")}</p>

        <section className="mt-10 rounded-2xl border border-[var(--usha-gold)]/30 bg-[var(--usha-gold)]/5 p-6">
          <h2 className="font-semibold">{t("volunteerTitle")}</h2>
          <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("volunteerBody")}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--usha-muted)]">
            {["ruleAge", "ruleAlcohol", "ruleLength", "ruleCancel", "ruleCheck", "ruleDecline"].map((k) => (
              <li key={k}>{t(k)}</li>
            ))}
          </ul>
        </section>

        {!user && (
          <section className="mt-6 rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6">
            <h2 className="flex items-center gap-2 font-semibold">
              <UserPlus size={18} className="text-[var(--usha-gold)]" />
              {t("accountTitle")}
            </h2>
            <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("accountBody")}</p>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Link href={to("/app/taxi")} className={gold}>
                {t("createAccount")}
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent("/app/taxi")}`}
                className="flex min-h-[48px] items-center justify-center rounded-xl border border-[var(--usha-border)] px-8 py-3 text-sm font-medium hover:border-[var(--usha-gold)]/40"
              >
                {t("haveAccount")}
              </Link>
            </div>
          </section>
        )}

        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">{t("upcomingTitle")}</h2>
          {evenings.length === 0 ? (
            <p className="text-sm text-[var(--usha-muted)]">{t("listEmpty")}</p>
          ) : (
            <div className="space-y-3">
              {evenings.map((e) => (
                <Link
                  key={e.id}
                  href={to(`/app/taxi/${e.id}`)}
                  className="block rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4 hover:border-[var(--usha-gold)]/40"
                >
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-sm text-[var(--usha-muted)]">{e.event_date}</p>
                  <p className="mt-2 text-xs text-[var(--usha-muted)]">
                    {e.shifts
                      .map((s) => `${time(s.starts_at)}–${time(s.ends_at)} ${t(`kind_${s.kind}`)} (${t("spotsLeft", { n: Math.max(0, s.capacity - s.booked) })})`)
                      .join(" · ")}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
}
