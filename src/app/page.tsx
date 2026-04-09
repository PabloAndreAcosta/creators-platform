"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { InstallPrompt } from "@/components/install-prompt";
import { LanguageSwitcher } from "@/components/language-switcher";
import { createClient } from "@/lib/supabase/client";
import {
  Menu,
  X,
  ArrowRight,
  Sparkles,
  Users,
  CalendarCheck,
  CreditCard,
  Zap,
  ChevronDown,
  Palette,
  Globe,
  Search,
  Star,
  BarChart3,
  Shield,
  ShieldCheck,
  Ticket,
  Store,
  Heart,
  UserPlus,
  Fingerprint,
  Lock,
} from "lucide-react";

/* ─────────────── NAV ─────────────── */
function Nav() {
  const t = useTranslations("landing");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsLoggedIn(!!user);
    });
  }, []);

  const pageLinks = [
    { href: "#ecosystem", label: t("nav.ecosystem") },
    { href: "#pricing", label: t("nav.pricing") },
  ];
  const appLinks = [
    { href: "/flode", label: t("nav.feed") },
    { href: "/upplevelser", label: t("nav.experiences") },
    { href: "/marketplace", label: t("nav.marketplace") },
  ];

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  function handleInstallClick(e: React.MouseEvent) {
    if (isLoggedIn) {
      // Already logged in — go to app
      window.location.href = "/app";
      return;
    }
    if (isMobile) {
      // Mobile — go to app/signup
      window.location.href = "/app";
      return;
    }
    // Desktop + not logged in — show install instructions
    e.preventDefault();
    setShowInstallModal(true);
  }

  return (
    <>
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[var(--usha-border)] bg-[var(--usha-black)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href={isLoggedIn ? "/app" : "#"} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-sm font-bold text-black">U</span>
          </div>
          <span className="text-lg font-bold tracking-tight">Usha</span>
        </a>

        <div className="hidden items-center gap-6 text-sm md:flex">
          {pageLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-[var(--usha-muted)] transition hover:text-white">
              {l.label}
            </a>
          ))}
          <span className="h-4 w-px bg-[var(--usha-border)]" />
          {appLinks.map((l) => (
            <a key={l.href} href={l.href} className="text-[#5ce0d2] transition hover:text-[#7eeee2]">
              {l.label}
            </a>
          ))}
          <button
            onClick={handleInstallClick}
            className="text-[#5ce0d2] transition hover:text-[#7eeee2]"
          >
            {isLoggedIn ? t("nav.openApp") : t("nav.downloadApp")}
          </button>
          <LanguageSwitcher />
        </div>

        <div className="flex items-center gap-3">
          <a
            href={isLoggedIn ? "/app" : "/signup"}
            className="hidden rounded-lg bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-2 text-sm font-semibold text-black transition hover:opacity-90 sm:block"
          >
            {isLoggedIn ? t("nav.openApp") : t("nav.getStarted")}
          </a>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-[var(--usha-muted)] transition hover:text-white md:hidden"
            aria-label={t("nav.menuAriaLabel")}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-[var(--usha-border)] bg-[var(--usha-black)] px-6 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {pageLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm text-[var(--usha-muted)] transition hover:text-white"
              >
                {l.label}
              </a>
            ))}
            <div className="my-1 h-px bg-[var(--usha-border)]" />
            {appLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="py-2 text-sm text-[#5ce0d2] transition hover:text-[#7eeee2]"
              >
                {l.label}
              </a>
            ))}
            <a
              href="/app"
              onClick={() => setMobileOpen(false)}
              className="py-2 text-sm text-[#5ce0d2] transition hover:text-[#7eeee2]"
            >
              {isLoggedIn ? t("nav.openApp") : t("nav.downloadApp")}
            </a>
            <div className="my-1 h-px bg-[var(--usha-border)]" />
            <LanguageSwitcher />
          </div>
        </div>
      )}
    </nav>

    {/* Install modal — desktop */}
    {showInstallModal && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowInstallModal(false)} />
        <div className="relative w-full max-w-md rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-black)] p-8 shadow-2xl">
          <button
            onClick={() => setShowInstallModal(false)}
            className="absolute right-4 top-4 rounded p-1 text-[var(--usha-muted)] transition hover:text-white"
          >
            <X size={16} />
          </button>

          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
            <span className="text-xl font-bold text-black">U</span>
          </div>

          <h3 className="mb-2 text-xl font-bold">{t("install.title")}</h3>
          <p className="mb-6 text-sm leading-relaxed text-[var(--usha-muted)]">
            {t("install.description")}
          </p>

          <div className="space-y-4">
            <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
              <p className="mb-1 text-sm font-semibold">{t("install.chromeEdge")}</p>
              <p className="text-xs text-[var(--usha-muted)]">
                {t("install.chromeEdgeInstructions")}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-4">
              <p className="mb-1 text-sm font-semibold">{t("install.safariMac")}</p>
              <p className="text-xs text-[var(--usha-muted)]">
                {t("install.safariMacInstructions")}
              </p>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setShowInstallModal(false)}
              className="flex-1 rounded-xl border border-[var(--usha-border)] py-3 text-sm font-medium text-[var(--usha-muted)] transition hover:text-white"
            >
              {t("install.close")}
            </button>
            <a
              href="/app"
              className="flex-1 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] py-3 text-center text-sm font-bold text-black transition hover:opacity-90"
            >
              {t("install.openInBrowser")}
            </a>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ─────────────── HERO ─────────────── */
function Hero() {
  const t = useTranslations("landing");

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-16 sm:px-6">
      {/* Background glows */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[600px] w-[900px] rounded-full bg-[var(--usha-gold)] opacity-[0.05] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <a
          href="/flode"
          className="animate-fade-up mb-8 inline-flex items-center gap-2 rounded-full border border-[#5ce0d2]/20 bg-[var(--usha-card)] px-5 py-2 text-xs transition hover:border-[#5ce0d2]/40 hover:bg-[var(--usha-card)]/80"
        >
          <Zap size={12} className="text-[#5ce0d2]" />
          <span className="text-[var(--usha-muted)]">{t("hero.badge")}</span>
          <ArrowRight size={12} className="text-[#5ce0d2]" />
        </a>

        {/* Headline */}
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
          className="animate-fade-up delay-200 mx-auto mb-10 max-w-xl text-base leading-relaxed text-[var(--usha-muted)] sm:mb-12 sm:text-lg"
          style={{ opacity: 0 }}
        >
          {t("hero.description")}
        </p>

        {/* CTA */}
        <div
          className="animate-fade-up delay-300 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
          style={{ opacity: 0 }}
        >
          <a
            href="/signup"
            className="glow-gold inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-3.5 text-sm font-bold text-black transition hover:scale-[1.02] hover:opacity-90 sm:w-auto sm:py-4 sm:text-base"
          >
            {t("hero.ctaPrimary")}
            <ArrowRight size={16} />
          </a>
          <a
            href="/upplevelser"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#5ce0d2]/30 px-8 py-3.5 text-sm font-medium text-[#5ce0d2] transition hover:border-[#5ce0d2]/50 hover:text-[#7eeee2] sm:w-auto sm:py-4 sm:text-base"
          >
            {t("hero.ctaSecondary")}
          </a>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="h-8 w-5 rounded-full border-2 border-[var(--usha-border)] p-1">
          <div className="mx-auto h-2 w-1 rounded-full bg-[var(--usha-gold)]" />
        </div>
      </div>
    </section>
  );
}

/* ─────────────── ECOSYSTEM ─────────────── */
function Ecosystem() {
  const t = useTranslations("landing");
  const [openPillar, setOpenPillar] = useState<number | null>(null);

  const ECOSYSTEM_PILLARS = [
    {
      icon: Palette,
      title: t("ecosystem.creators.title"),
      desc: t("ecosystem.creators.desc"),
      color: "from-[var(--usha-gold)] to-amber-600",
      details: [
        { icon: Palette, text: t("ecosystem.creators.detail1") },
        { icon: Ticket, text: t("ecosystem.creators.detail2") },
        { icon: Globe, text: t("ecosystem.creators.detail3") },
        { icon: BarChart3, text: t("ecosystem.creators.detail4") },
      ],
    },
    {
      icon: Store,
      title: t("ecosystem.experiences.title"),
      desc: t("ecosystem.experiences.desc"),
      color: "from-[var(--usha-accent)] to-rose-500",
      details: [
        { icon: Ticket, text: t("ecosystem.experiences.detail1") },
        { icon: Search, text: t("ecosystem.experiences.detail2") },
        { icon: Users, text: t("ecosystem.experiences.detail3") },
        { icon: Globe, text: t("ecosystem.experiences.detail4") },
      ],
    },
    {
      icon: Heart,
      title: t("ecosystem.customers.title"),
      desc: t("ecosystem.customers.desc"),
      color: "from-sky-500 to-blue-500",
      details: [
        { icon: Search, text: t("ecosystem.customers.detail1") },
        { icon: CalendarCheck, text: t("ecosystem.customers.detail2") },
        { icon: CreditCard, text: t("ecosystem.customers.detail3") },
        { icon: Star, text: t("ecosystem.customers.detail4") },
      ],
    },
  ];

  return (
    <section id="ecosystem" className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[700px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[180px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-16">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
            {t("ecosystem.title")} <span className="text-gradient">{t("ecosystem.titleHighlight")}</span>
          </h2>
          <p className="mx-auto max-w-xl text-[var(--usha-muted)]">
            {t("ecosystem.subtitle")}
          </p>
        </div>

        <div className="space-y-4">
          {ECOSYSTEM_PILLARS.map((pillar, i) => {
            const isOpen = openPillar === i;
            return (
              <div key={pillar.title} className={`rounded-2xl border bg-[var(--usha-card)] transition-all ${isOpen ? "border-[var(--usha-gold)]/30" : "border-[var(--usha-border)] hover:border-[var(--usha-gold)]/20"}`}>
                <button
                  onClick={() => setOpenPillar(isOpen ? null : i)}
                  className="flex w-full items-center gap-4 p-6 text-left"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${pillar.color}`}>
                    <pillar.icon size={18} className="text-black" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">{pillar.title}</h3>
                    <p className="mt-1 text-sm text-[var(--usha-muted)]">{pillar.desc}</p>
                  </div>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-[var(--usha-muted)] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--usha-border)] px-6 pb-6 pt-4">
                    <ul className="grid gap-3 sm:grid-cols-2">
                      {pillar.details.map((detail) => (
                        <li key={detail.text} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--usha-gold)]/10">
                            <detail.icon size={14} className="text-[var(--usha-gold)]" />
                          </div>
                          <span className="text-sm text-[var(--usha-muted)]">{detail.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Loop message */}
        <p className="mt-8 text-center text-sm text-[var(--usha-muted)]">
          {t("ecosystem.loopMessage")}
        </p>
      </div>
    </section>
  );
}

/* ─────────────── ONBOARDING ─────────────── */
function Onboarding() {
  const t = useTranslations("landing");

  const ONBOARDING_STEPS = [
    {
      icon: UserPlus,
      title: t("onboarding.step1Title"),
      desc: t("onboarding.step1Desc"),
    },
    {
      icon: Palette,
      title: t("onboarding.step2Title"),
      desc: t("onboarding.step2Desc"),
    },
    {
      icon: CalendarCheck,
      title: t("onboarding.step3Title"),
      desc: t("onboarding.step3Desc"),
    },
  ];

  return (
    <section className="relative py-16 px-4 sm:py-20 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-12">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl">
            {t("onboarding.title")} <span className="text-gradient">{t("onboarding.titleHighlight")}</span>
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {ONBOARDING_STEPS.map((step, i) => (
            <div key={step.title} className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                <step.icon size={20} className="text-black" />
              </div>
              <span className="mb-2 block font-mono text-xs text-[var(--usha-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mb-1 font-semibold">{step.title}</h3>
              <p className="text-sm text-[var(--usha-muted)]">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── TRUST ─────────────── */
function Trust() {
  const t = useTranslations("landing");

  const TRUST_POINTS = [
    {
      icon: Fingerprint,
      title: t("trust.bankid.title"),
      desc: t("trust.bankid.desc"),
    },
    {
      icon: Lock,
      title: t("trust.payment.title"),
      desc: t("trust.payment.desc"),
    },
    {
      icon: ShieldCheck,
      title: t("trust.booking.title"),
      desc: t("trust.booking.desc"),
    },
  ];

  return (
    <section className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[600px] rounded-full bg-[var(--usha-gold)] opacity-[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl">
        <div className="mb-10 text-center sm:mb-16">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-4 py-1.5 text-xs sm:mb-4">
            <Shield size={12} className="text-[var(--usha-gold)]" />
            <span className="text-[var(--usha-muted)]">{t("trust.badge")}</span>
          </div>
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
            {t("trust.title")} <span className="text-gradient">{t("trust.titleHighlight")}</span>
          </h2>
          <p className="mx-auto max-w-xl text-[var(--usha-muted)]">
            {t("trust.subtitle")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {TRUST_POINTS.map((point) => (
            <div
              key={point.title}
              className="rounded-2xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-6 transition hover:border-[var(--usha-gold)]/20"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)]/20 to-[var(--usha-accent)]/20">
                <point.icon size={20} className="text-[var(--usha-gold)]" />
              </div>
              <h3 className="mb-2 font-semibold">{point.title}</h3>
              <p className="text-sm leading-relaxed text-[var(--usha-muted)]">{point.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── PRICING ─────────────── */
function Pricing() {
  const t = useTranslations("landing");
  const [activeRole, setActiveRole] = useState<"publik" | "kreator" | "upplevelse">("kreator");

  const ROLE_TABS = [
    { key: "publik" as const, label: t("pricing.roleUser") },
    { key: "kreator" as const, label: t("pricing.roleCreator") },
    { key: "upplevelse" as const, label: t("pricing.roleExperience") },
  ];

  const PRICING_DATA: Record<string, { gratis: { features: string[] }; guld: { price: number; features: string[]; popular: boolean }; premium: { price: number; features: string[]; popular: boolean } }> = {
    publik: {
      gratis: {
        features: [
          t("pricing.publikFree1"),
          t("pricing.publikFree2"),
          t("pricing.publikFree3"),
        ],
      },
      guld: {
        price: 199,
        popular: true,
        features: [
          t("pricing.publikGold1"),
          t("pricing.publikGold2"),
          t("pricing.publikGold3"),
          t("pricing.publikGold4"),
        ],
      },
      premium: {
        price: 499,
        popular: false,
        features: [
          t("pricing.publikPremium1"),
          t("pricing.publikPremium2"),
          t("pricing.publikPremium3"),
          t("pricing.publikPremium4"),
        ],
      },
    },
    kreator: {
      gratis: {
        features: [
          t("pricing.kreatorFree1"),
          t("pricing.kreatorFree2"),
          t("pricing.kreatorFree3"),
        ],
      },
      guld: {
        price: 299,
        popular: true,
        features: [
          t("pricing.kreatorGold1"),
          t("pricing.kreatorGold2"),
          t("pricing.kreatorGold3"),
          t("pricing.kreatorGold4"),
          t("pricing.kreatorGold5"),
        ],
      },
      premium: {
        price: 599,
        popular: false,
        features: [
          t("pricing.kreatorPremium1"),
          t("pricing.kreatorPremium2"),
          t("pricing.kreatorPremium3"),
          t("pricing.kreatorPremium4"),
          t("pricing.kreatorPremium5"),
        ],
      },
    },
    upplevelse: {
      gratis: {
        features: [
          t("pricing.upplevelseFree1"),
          t("pricing.upplevelseFree2"),
          t("pricing.upplevelseFree3"),
        ],
      },
      guld: {
        price: 299,
        popular: true,
        features: [
          t("pricing.upplevelseGold1"),
          t("pricing.upplevelseGold2"),
          t("pricing.upplevelseGold3"),
          t("pricing.upplevelseGold4"),
        ],
      },
      premium: {
        price: 599,
        popular: false,
        features: [
          t("pricing.upplevelsePremium1"),
          t("pricing.upplevelsePremium2"),
          t("pricing.upplevelsePremium3"),
          t("pricing.upplevelsePremium4"),
          t("pricing.upplevelsePremium5"),
        ],
      },
    },
  };

  const data = PRICING_DATA[activeRole];

  const tiers = [
    { name: t("pricing.free"), price: 0, desc: t("pricing.freeDesc"), features: data.gratis.features, cta: t("pricing.ctaFree"), popular: false },
    { name: t("pricing.gold"), price: data.guld.price, desc: t("pricing.goldDesc"), features: data.guld.features, cta: t("pricing.ctaGold"), popular: data.guld.popular },
    { name: t("pricing.premium"), price: data.premium.price, desc: t("pricing.premiumDesc"), features: data.premium.features, cta: t("pricing.ctaPremium"), popular: data.premium.popular },
  ];

  return (
    <section id="pricing" className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[600px] rounded-full bg-[var(--usha-accent)] opacity-[0.03] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-5xl">
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="mb-3 text-2xl font-bold tracking-tight sm:mb-4 sm:text-3xl md:text-4xl">
            {t("pricing.title")}
          </h2>
          <p className="mx-auto max-w-xl text-sm text-[var(--usha-muted)] sm:text-base">
            {t("pricing.subtitle")}
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-[var(--usha-muted)]">
            {t("pricing.betaNotice")} <span className="font-semibold text-[var(--usha-gold)]">{t("pricing.betaHighlight")}</span> {t("pricing.betaSuffix")}
          </p>
        </div>

        {/* Role tabs */}
        <div className="mb-8 flex justify-center sm:mb-12">
          <div className="inline-flex rounded-xl border border-[var(--usha-border)] bg-[var(--usha-card)] p-1">
            {ROLE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveRole(tab.key)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition sm:px-6 sm:py-2.5 sm:text-sm ${
                  activeRole === tab.key
                    ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black"
                    : "text-[var(--usha-muted)] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-5 transition-all sm:p-8 ${
                plan.popular
                  ? "border-[var(--usha-gold)]/40 bg-[var(--usha-card)] glow-gold scale-[1.02]"
                  : "border-[var(--usha-border)] bg-[var(--usha-card)] hover:border-[var(--usha-gold)]/20"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-4 py-1 text-xs font-bold text-black">
                  {t("pricing.mostPopular")}
                </div>
              )}

              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-[var(--usha-muted)]">
                {plan.desc}
              </p>

              <div className="my-6">
                {plan.price > 0 ? (
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-extrabold text-[var(--usha-gold)]">0</span>
                    <span className="text-[var(--usha-muted)]">{t("pricing.sekMonth")}</span>
                    <span className="text-lg text-[var(--usha-muted)] line-through decoration-[var(--usha-muted)]/50">
                      {plan.price} SEK
                    </span>
                  </div>
                ) : (
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">0</span>
                    <span className="text-[var(--usha-muted)]">{t("pricing.sekForever")}</span>
                  </div>
                )}
                {plan.price > 0 && (
                  <p className="mt-1 text-xs text-[var(--usha-gold)]">{t("pricing.freeDuringBeta")}</p>
                )}
              </div>

              <ul className="mb-8 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 text-[var(--usha-gold)]">&#10003;</span>
                    <span className="text-[var(--usha-muted)]">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href="/signup"
                className={`block w-full rounded-xl py-3 text-center text-sm font-semibold transition ${
                  plan.popular
                    ? "bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] text-black hover:opacity-90"
                    : "border border-[var(--usha-border)] text-white hover:border-[var(--usha-gold)]/30"
                }`}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────── CTA ─────────────── */
function CTA() {
  const t = useTranslations("landing");

  return (
    <section className="relative py-16 px-4 sm:py-28 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--usha-gold)] opacity-[0.06] blur-[150px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--usha-gold)]/20 bg-[var(--usha-card)] px-4 py-1.5 text-xs">
          <Sparkles size={12} className="text-[var(--usha-gold)]" />
          <span className="text-[var(--usha-muted)]">{t("cta.badge")}</span>
        </div>

        <h2 className="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl md:text-4xl">
          {t("cta.title")}
        </h2>
        <p className="mb-8 text-base text-[var(--usha-muted)] sm:mb-10 sm:text-lg">
          {t("cta.description")}
        </p>

        <a
          href="/signup"
          className="glow-gold inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--usha-gold)] to-[var(--usha-accent)] px-8 py-4 text-base font-bold text-black transition hover:scale-[1.02] hover:opacity-90"
        >
          {t("cta.button")}
          <ArrowRight size={16} />
        </a>
      </div>
    </section>
  );
}

/* ─────────────── FOOTER ─────────────── */
function Footer() {
  const t = useTranslations("landing");

  const FOOTER_LINKS = {
    [t("footer.platform")]: [
      { label: t("footer.marketplace"), href: "/marketplace" },
      { label: t("footer.pricing"), href: "#pricing" },
    ],
    [t("footer.legal")]: [
      { label: t("footer.terms"), href: "/terms" },
      { label: t("footer.privacy"), href: "/privacy" },
      { label: t("footer.cookies"), href: "/cookies" },
    ],
  };

  return (
    <footer className="border-t border-[var(--usha-border)] pt-12 pb-8 px-4 sm:pt-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
                <span className="text-sm font-bold text-black">U</span>
              </div>
              <span className="text-lg font-bold tracking-tight">Usha</span>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-[var(--usha-muted)]">
              {t("footer.description")}
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([title, links]) => (
            <div key={title}>
              <h4 className="mb-4 text-sm font-semibold">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-[var(--usha-muted)] transition-colors hover:text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-[var(--usha-border)] pt-8 sm:flex-row">
          <p className="font-mono text-xs text-[var(--usha-muted)]">
            {t("footer.copyright")}
          </p>
          <p className="text-xs text-[var(--usha-muted)]">
            {t("footer.builtWith")}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────── PAGE ─────────────── */
export default function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) {
        window.location.href = "/app";
      } else {
        setReady(true);
      }
    });
  }, []);

  // Don't show landing page while checking auth (prevents flash)
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--usha-black)]">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--usha-gold)] to-[var(--usha-accent)]">
          <span className="text-lg font-bold text-black">U</span>
        </div>
      </div>
    );
  }

  return (
    <main>
      <Nav />
      <Hero />
      <Ecosystem />
      <Onboarding />
      <Trust />
      <Pricing />
      <CTA />
      <Footer />
      <InstallPrompt />
    </main>
  );
}
