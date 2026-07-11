import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/landing/nav";
import { PerspectiveHero } from "@/components/landing/perspective-hero";
import { Onboarding } from "@/components/landing/onboarding";
import { Features } from "@/components/landing/features";
import { Pricing } from "@/components/landing/pricing";
import { LoopSection } from "@/components/landing/loop-section";
import { PerspectiveLinks } from "@/components/landing/perspective-links";
import { Trust } from "@/components/landing/trust";
import { Footer } from "@/components/landing/footer";
import { RedirectIfAuthed } from "@/components/landing/redirect-if-authed";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("forCreators");
  const title = t("meta.title");
  const description = t("meta.description");
  return {
    title,
    description,
    alternates: { canonical: "/for-kreatorer" },
    openGraph: { title, description, url: "https://usha.se/for-kreatorer", type: "website", locale: "sv_SE", siteName: "Usha Platform" },
  };
}

export default function ForCreatorsPage() {
  return (
    <main>
      <RedirectIfAuthed />
      <Nav />
      <PerspectiveHero ns="forCreators" ctaHref="/signup" />
      <Onboarding />
      <Features />
      <Pricing />
      <LoopSection ns="forCreators" />
      <PerspectiveLinks exclude="creators" />
      <Trust />
      <Footer />
    </main>
  );
}
