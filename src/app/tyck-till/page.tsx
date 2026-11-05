import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ClipboardList, MessageCircleHeart } from "lucide-react";
import { SiteNav } from "@/components/landing/site-nav";
import { Footer } from "@/components/landing/footer";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stockholmToday } from "@/lib/time";
import { approvalScopeKey } from "@/lib/taxi/approvals";
import { DjWishes } from "@/app/event/[slug]/dj-wishes";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("tyckTill");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/tyck-till" },
    openGraph: {
      title: t("metaTitle"),
      description: t("metaDescription"),
      url: "https://usha.se/tyck-till",
      type: "website",
      siteName: "Usha Platform",
    },
  };
}

/**
 * Enkäterna till torsdagarna på The Lab. Bara formulär som är öppna för
 * alla hör hemma här — ett formulär som kräver Google-inloggning i usha.se
 * ger besökaren en 401. De övriga tre (Instruktörer och teknik, Musik och DJ,
 * Praktiskt) läggs till när de publicerats för alla i Google Forms.
 */
const SURVEYS: { key: string; url: string }[] = [
  {
    key: "surveyTaxi",
    url: "https://docs.google.com/forms/d/e/1FAIpQLScqa6-ouASzkxXiMcu4sha7Kau6WE9BxNNoOtQiUT9aXQOzAg/viewform",
  },
];

/**
 * "Tyck till" samlar frågorna till publiken som inte hör till en enskild
 * kväll: DJ-röstningen (som gäller månadsfester och festivaler) och
 * enkäterna. DJ-listan följer arrangörens serie, så den läses via nästa
 * practica — samma lista och samma röster som på evenemangssidan.
 */
export default async function TyckTillPage() {
  const t = await getTranslations("tyckTill");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: practica } = await createAdminClient()
    .from("listings")
    .select("id, user_id, series_id")
    .eq("is_practica", true)
    .eq("is_active", true)
    .gte("event_date", stockholmToday())
    .order("event_date")
    .limit(1)
    .maybeSingle();

  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
          <MessageCircleHeart size={28} className="text-[var(--usha-gold)]" />
        </div>
        <h1 className="text-center text-4xl font-bold leading-tight">{t("title")}</h1>
        <p className="mx-auto mb-10 mt-4 max-w-2xl text-center text-[var(--usha-muted)]">{t("intro")}</p>

        {practica && (
          <DjWishes
            listingId={practica.id}
            scopeKey={approvalScopeKey({ series_id: practica.series_id ?? null, user_id: practica.user_id })}
            viewerId={user?.id ?? null}
            backPath="/tyck-till"
          />
        )}

        {SURVEYS.length > 0 && (
          <section className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-5">
            <p className="flex items-center gap-2 font-semibold">
              <ClipboardList size={18} className="text-[var(--usha-gold)]" />
              {t("surveysTitle")}
            </p>
            <p className="mt-1 text-sm text-[var(--usha-muted)]">{t("surveysBody")}</p>
            <ul className="mt-4 space-y-2">
              {SURVEYS.map((s) => (
                <li key={s.key}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between rounded-xl border border-[var(--usha-border)] px-4 py-3 text-sm font-medium transition hover:border-[var(--usha-gold)]/40"
                  >
                    {t(s.key)}
                    <span className="text-xs font-semibold text-[var(--usha-gold)]">{t("surveyOpen")}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
