import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { safeJsonLd } from "@/lib/json-ld";
import { LandingStats } from "@/components/landing-stats";
import { Nav } from "@/components/landing/nav";
import { Ecosystem } from "@/components/landing/ecosystem";
import { Trust } from "@/components/landing/trust";
import { Footer } from "@/components/landing/footer";
import { AudienceDoors } from "@/components/landing/audience-doors";
import { RedirectIfAuthed } from "@/components/landing/redirect-if-authed";

// The home page leads with the ecosystem/cycle idea (not the event tooling,
// which now lives on /for-kreatorer).
export const metadata: Metadata = {
  title: "Usch-Ja! — Där kreatörer, platser och publik möts",
  description:
    "Kretsloppet som får Sveriges kreativa liv att snurra – kreatörer hittar uppdrag, platser fyller sin kalender, publiken upptäcker upplevelser. Tryggt med BankID och Stripe.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Usch-Ja! — Där kreatörer, platser och publik möts",
    description:
      "Kretsloppet där kreatörer, platser och publik förstärker varandra. Tryggt med BankID och Stripe.",
    url: "https://usha.se",
    type: "website",
    locale: "sv_SE",
    siteName: "Usch-Ja!",
  },
  twitter: {
    card: "summary_large_image",
    title: "Usch-Ja! — Där kreatörer, platser och publik möts",
    description:
      "Kretsloppet där kreatörer, platser och publik förstärker varandra. Tryggt med BankID och Stripe.",
  },
};

// Organization structured data (company Usha AB, product Usch-Ja!).
const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Usch-Ja!",
  legalName: "Usha AB",
  url: "https://usha.se",
  logo: "https://usha.se/icon-192.png",
  description:
    "Kuraterad, BankID-verifierad marknadsplats som förenar kreatörer, platser och publik.",
};

/* ─────────────── HERO (the cycle) ─────────────── */
function Hero() {
  const t = useTranslations("landing");

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-16 sm:px-6">
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[600px] w-[900px] rounded-full bg-[var(--usha-gold)] opacity-[0.05] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-5 py-2 text-xs">
          <span className="text-[var(--usha-muted)]">{t("hero.badge")}</span>
        </div>

        <h1
          className="animate-fade-up delay-100 mb-6 text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
          style={{ opacity: 0 }}
        >
          {t("hero.headlinePart1")}{" "}
          <br className="hidden sm:block" />
          <span className="text-gradient">{t("hero.headlinePart2")}</span>
        </h1>

        {/* Hero video */}
        <div
          className="animate-fade-up delay-150 mx-auto mb-8 max-w-3xl overflow-hidden rounded-xl border border-[var(--usha-border)] sm:mb-10 sm:rounded-2xl"
          style={{ opacity: 0 }}
        >
          <video
            autoPlay
            loop
            muted
            playsInline
            className="w-full max-h-[50vh] object-cover sm:max-h-none"
            suppressHydrationWarning
          >
            <source src="/hero-video.mp4" type="video/mp4" />
          </video>
        </div>

        <p
          className="animate-fade-up delay-200 mx-auto mb-10 max-w-2xl text-base leading-relaxed text-[var(--usha-muted)] sm:mb-12 sm:text-lg"
          style={{ opacity: 0 }}
        >
          {t("hero.description")}
        </p>

        {/* Three doors into the cycle */}
        <div className="animate-fade-up delay-300 w-full" style={{ opacity: 0 }}>
          <AudienceDoors />
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="h-8 w-5 rounded-full border-2 border-[var(--usha-border)] p-1">
          <div className="mx-auto h-2 w-1 rounded-full bg-[var(--usha-gold)]" />
        </div>
      </div>
    </section>
  );
}

/* ─────────────── CLOSING CTA (pick your door) ─────────────── */
function HomeCta() {
  const t = useTranslations("landing");

  return (
    <section className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--usha-gold)] opacity-[0.06] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl text-center">
        <h2 className="mb-3 text-2xl font-bold sm:text-3xl md:text-4xl">{t("homeCta.title")}</h2>
        <p className="mb-8 text-base text-[var(--usha-muted)] sm:mb-10 sm:text-lg">
          {t("homeCta.description")}
        </p>
        <AudienceDoors />
      </div>
    </section>
  );
}

/* ─────────────── PAGE (Server Component) ─────────────── */
export default function Home() {
  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(ORGANIZATION_JSONLD) }}
      />
      {/* Non-blocking: logged-in users go to /app after render; anonymous
          visitors and crawlers always get the full landing HTML. */}
      <RedirectIfAuthed />
      <Nav />
      <Hero />
      <LandingStats />
      <Ecosystem />
      <Trust />
      <HomeCta />
      <Footer />
    </main>
  );
}
