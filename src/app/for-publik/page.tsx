import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Nav } from "@/components/landing/nav";
import { PerspectiveHero } from "@/components/landing/perspective-hero";
import { LoopSection } from "@/components/landing/loop-section";
import { PerspectiveLinks } from "@/components/landing/perspective-links";
import { Trust } from "@/components/landing/trust";
import { Footer } from "@/components/landing/footer";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("forAudience");
  const title = t("meta.title");
  const description = t("meta.description");
  return {
    title,
    description,
    alternates: { canonical: "/for-publik" },
    openGraph: { title, description, url: "https://usha.se/for-publik", type: "website", locale: "sv_SE", siteName: "Usch-Ja!" },
  };
}

export default function ForAudiencePage() {
  return (
    <main>
      <Nav />
      {/* Primary CTA leads into the functional browse page */}
      <PerspectiveHero ns="forAudience" ctaHref="/upplevelser" />
      <LoopSection ns="forAudience" />
      <PerspectiveLinks exclude="audience" />
      <Trust />
      <Footer />
    </main>
  );
}
