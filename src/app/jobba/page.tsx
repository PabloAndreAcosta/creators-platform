import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteNav } from "@/components/landing/site-nav";
import { Footer } from "@/components/landing/footer";
import { createClient } from "@/lib/supabase/server";
import { WorkLadder } from "@/components/work/work-ladder";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("work");
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/jobba" },
    openGraph: { title: t("metaTitle"), description: t("metaDescription"), url: "https://usha.se/jobba", type: "website", siteName: "Usha Platform" },
  };
}

/** Öppna sidan "Jobba med Usha" — länken i marknadsföringen. */
export default async function WorkLandingPage() {
  const t = await getTranslations("work");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <div className="min-h-screen bg-[var(--usha-black)]">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 pb-20 pt-28">
        <h1 className="text-center text-4xl font-bold leading-tight">{t("title")}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-[var(--usha-muted)]">{t("intro")}</p>
        <div className="mt-10">
          <WorkLadder loggedIn={!!user} />
        </div>
      </main>
      <Footer />
    </div>
  );
}
